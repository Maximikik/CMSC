using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Sitewright.Api.Data;

namespace Sitewright.Api.Services;

public record Access(Site Site, SiteRole Role)
{
    public bool IsOwner => Role == SiteRole.Owner;
}

public static class SiteAccess
{
    public static Guid UserId(this ClaimsPrincipal u) => Guid.Parse(u.FindFirstValue("sub")!);
    public static bool IsAdmin(this ClaimsPrincipal u) => u.HasClaim("role", "Admin");

    /// <summary>
    /// Loads a site the caller may touch. Returns null for both "does not exist" and "not yours",
    /// so the API never confirms that someone else's site exists. Admins act as owners everywhere.
    /// </summary>
    public static async Task<Access?> Find(AppDb db, ClaimsPrincipal user, Guid siteId, CancellationToken ct = default)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == siteId, ct);
        if (site is null) return null;
        if (user.IsAdmin()) return new Access(site, SiteRole.Owner);
        var uid = user.UserId();
        var m = await db.SiteMembers.AsNoTracking().FirstOrDefaultAsync(x => x.SiteId == siteId && x.UserId == uid, ct);
        return m is null ? null : new Access(site, m.Role);
    }
}
