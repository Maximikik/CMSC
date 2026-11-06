using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Sitewright.Api.Data;
using Sitewright.Api.Services;

namespace Sitewright.Api.Endpoints;

public record CreateSiteRequest(string Name, string? Slug, JsonElement? Document);
public record RenameSiteRequest(string? Name, string? Slug);
public record SaveDraftRequest(int BaseVersion, JsonElement Document);
public record PublishRequest(int BaseVersion, string Html, string? Note);
public record MemberRequest(string Email, string Role);

public static class SiteEndpoints
{
    static string RoleName(SiteRole r) => r == SiteRole.Owner ? "owner" : "editor";

    static object Summary(Site s, SiteRole role, SiteFiles files) => new
    {
        id = s.Id, name = s.Name, slug = s.Slug, updatedAt = s.UpdatedAt, publishedAt = s.PublishedAt,
        published = s.Published != null, role = RoleName(role),
        url = s.Published != null ? files.SiteUrl(s.Slug) : null,
    };

    static object Detail(Site s, SiteRole role, SiteFiles files) => new
    {
        id = s.Id, name = s.Name, slug = s.Slug, version = s.Version,
        document = JsonDocument.Parse(s.Draft).RootElement.Clone(),
        updatedAt = s.UpdatedAt, publishedAt = s.PublishedAt,
        published = s.Published != null,
        unpublishedChanges = s.Published != null && s.PublishedDraftVersion != s.Version,
        role = RoleName(role),
        url = s.Published != null ? files.SiteUrl(s.Slug) : null,
        publicBase = files.PublicBase,
    };

    static string DefaultDoc(string name) => JsonSerializer.Serialize(new
    {
        name,
        theme = new { primary = "#0f766e", bg = "#ffffff", text = "#14181f", font = "DM Sans", radius = 10 },
        pages = new[] { new { id = "pg_" + Guid.NewGuid().ToString("N")[..8], name = "Home", slug = "home", title = "", blocks = Array.Empty<object>() } },
    });

    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/sites").RequireAuthorization();

        g.MapGet("", async (ClaimsPrincipal u, AppDb db, SiteFiles files) =>
        {
            var q = db.Sites.AsNoTracking().Include(s => s.Members).AsQueryable();
            var uid = u.UserId();
            if (!u.IsAdmin()) q = q.Where(s => s.Members.Any(m => m.UserId == uid));
            var list = await q.OrderByDescending(s => s.UpdatedAt).ToListAsync();
            return list.Select(s =>
            {
                var role = s.Members.FirstOrDefault(m => m.UserId == uid)?.Role ?? SiteRole.Owner;
                return Summary(s, role, files);
            });
        });

        g.MapPost("", async (CreateSiteRequest r, ClaimsPrincipal u, AppDb db, SiteFiles files) =>
        {
            var name = (r.Name ?? "").Trim();
            if (name.Length is 0 or > 120) return Results.Problem("Give the site a name of up to 120 characters.", statusCode: 400);

            var slug = string.IsNullOrWhiteSpace(r.Slug) ? DocumentValidator.Slugify(name) : r.Slug.Trim().ToLowerInvariant();
            if (!DocumentValidator.SlugRx().IsMatch(slug)) return Results.Problem("The address may only use lowercase letters, numbers and hyphens.", statusCode: 400);
            if (DocumentValidator.ReservedSlugs.Contains(slug)) return Results.Problem($"\"{slug}\" is reserved. Pick another address.", statusCode: 400);

            // Suggested slugs get a numeric suffix when taken; slugs typed by the user must be free.
            if (await db.Sites.AnyAsync(s => s.Slug == slug))
            {
                if (!string.IsNullOrWhiteSpace(r.Slug)) return Results.Problem($"The address \"{slug}\" is already used.", statusCode: 409);
                var n = 2; while (await db.Sites.AnyAsync(s => s.Slug == $"{slug}-{n}")) n++;
                slug = $"{slug}-{n}";
            }

            string draft;
            if (r.Document is { } d)
            {
                var err = DocumentValidator.Validate(d, out draft);
                if (err != null) return Results.Problem(err, statusCode: 400);
            }
            else draft = DefaultDoc(name);

            var site = new Site { Name = name, Slug = slug, Draft = draft, UpdatedById = u.UserId() };
            site.Members.Add(new SiteMember { UserId = u.UserId(), Role = SiteRole.Owner });
            db.Sites.Add(site);
            await db.SaveChangesAsync();
            return Results.Ok(Detail(site, SiteRole.Owner, files));
        });

        g.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal u, AppDb db, SiteFiles files) =>
        {
            var a = await SiteAccess.Find(db, u, id);
            return a is null ? Results.NotFound() : Results.Ok(Detail(a.Site, a.Role, files));
        });

        g.MapPut("/{id:guid}/draft", async (Guid id, SaveDraftRequest r, ClaimsPrincipal u, AppDb db) =>
        {
            var a = await SiteAccess.Find(db, u, id);
            if (a is null) return Results.NotFound();
            var err = DocumentValidator.Validate(r.Document, out var raw);
            if (err != null) return Results.Problem(err, statusCode: 400);
            if (a.Site.Version != r.BaseVersion)
                return Results.Problem("Someone else saved this site after you opened it. Reload to see their changes.", statusCode: 409);

            a.Site.Draft = raw;
            a.Site.Version++;
            a.Site.UpdatedAt = DateTime.UtcNow;
            a.Site.UpdatedById = u.UserId();
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateConcurrencyException)
            {
                return Results.Problem("Someone else saved this site at the same moment. Reload to see their changes.", statusCode: 409);
            }
            return Results.Ok(new { version = a.Site.Version, updatedAt = a.Site.UpdatedAt });
        });

        g.MapPatch("/{id:guid}", async (Guid id, RenameSiteRequest r, ClaimsPrincipal u, AppDb db) =>
        {
            var a = await SiteAccess.Find(db, u, id);
            if (a is null) return Results.NotFound();
            if (!a.IsOwner) return Results.Problem("Only an owner can change this.", statusCode: 403);
            if (r.Name is { } name)
            {
                if (name.Trim().Length is 0 or > 120) return Results.Problem("Give the site a name of up to 120 characters.", statusCode: 400);
                a.Site.Name = name.Trim();
            }
            if (r.Slug is { } slug && slug != a.Site.Slug)
            {
                if (a.Site.Published != null) return Results.Problem("Unpublish the site before changing its address.", statusCode: 409);
                slug = slug.Trim().ToLowerInvariant();
                if (!DocumentValidator.SlugRx().IsMatch(slug) || DocumentValidator.ReservedSlugs.Contains(slug))
                    return Results.Problem("Pick an address using lowercase letters, numbers and hyphens.", statusCode: 400);
                if (await db.Sites.AnyAsync(s => s.Slug == slug)) return Results.Problem($"The address \"{slug}\" is already used.", statusCode: 409);
                a.Site.Slug = slug;
            }
            a.Site.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return Results.Ok(new { name = a.Site.Name, slug = a.Site.Slug });
        });

        g.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal u, AppDb db, SiteFiles files) =>
        {
            var a = await SiteAccess.Find(db, u, id);
            if (a is null) return Results.NotFound();
            if (!a.IsOwner) return Results.Problem("Only an owner can delete a site.", statusCode: 403);
            db.Sites.Remove(a.Site);
            await db.SaveChangesAsync();
            files.DeletePublished(a.Site.Slug);
            files.DeleteAssets(a.Site.Id);
            return Results.NoContent();
        });

        // ---------- publishing ----------
        g.MapPost("/{id:guid}/publish", async (Guid id, PublishRequest r, ClaimsPrincipal u, AppDb db, SiteFiles files, CancellationToken ct) =>
        {
            var a = await SiteAccess.Find(db, u, id, ct);
            if (a is null) return Results.NotFound();
            var s = a.Site;
            if (s.Version != r.BaseVersion)
                return Results.Problem("The site changed since this page was generated. Save and try again.", statusCode: 409);
            if (string.IsNullOrWhiteSpace(r.Html) || r.Html.Length > 8 * 1024 * 1024 || !r.Html.TrimStart().StartsWith("<!doctype html", StringComparison.OrdinalIgnoreCase))
                return Results.Problem("The generated page is missing or too large.", statusCode: 400);

            var number = (await db.SiteVersions.Where(v => v.SiteId == id).MaxAsync(v => (int?)v.Number, ct) ?? 0) + 1;
            db.SiteVersions.Add(new SiteVersion { SiteId = id, Number = number, Document = s.Draft, Note = r.Note?.Trim() is { Length: > 0 } n ? n[..Math.Min(n.Length, 300)] : null, CreatedById = u.UserId() });
            s.Published = s.Draft;
            s.PublishedAt = DateTime.UtcNow;
            s.PublishedVersionNumber = number;
            s.PublishedDraftVersion = s.Version;

            var staged = await files.StageAsync(s.Slug, r.Html, ct);
            try
            {
                await db.SaveChangesAsync(ct);
                files.Commit(s.Slug, staged);
            }
            catch { files.Discard(staged); throw; }
            return Results.Ok(new { url = files.SiteUrl(s.Slug), publishedAt = s.PublishedAt, versionNumber = number });
        });

        g.MapPost("/{id:guid}/unpublish", async (Guid id, ClaimsPrincipal u, AppDb db, SiteFiles files) =>
        {
            var a = await SiteAccess.Find(db, u, id);
            if (a is null) return Results.NotFound();
            a.Site.Published = null; a.Site.PublishedAt = null; a.Site.PublishedVersionNumber = null; a.Site.PublishedDraftVersion = null;
            await db.SaveChangesAsync();
            files.DeletePublished(a.Site.Slug);
            return Results.NoContent();
        });

        g.MapGet("/{id:guid}/versions", async (Guid id, ClaimsPrincipal u, AppDb db) =>
        {
            var a = await SiteAccess.Find(db, u, id);
            if (a is null) return Results.NotFound();
            var list = await db.SiteVersions.AsNoTracking().Where(v => v.SiteId == id).OrderByDescending(v => v.Number)
                .Join(db.Users, v => v.CreatedById, usr => usr.Id, (v, usr) => new { v.Number, v.Note, v.CreatedAt, by = usr.DisplayName }).Take(50).ToListAsync();
            return Results.Ok(list);
        });

        g.MapPost("/{id:guid}/versions/{number:int}/restore", async (Guid id, int number, ClaimsPrincipal u, AppDb db) =>
        {
            var a = await SiteAccess.Find(db, u, id);
            if (a is null) return Results.NotFound();
            var v = await db.SiteVersions.FirstOrDefaultAsync(x => x.SiteId == id && x.Number == number);
            if (v is null) return Results.NotFound();
            a.Site.Draft = v.Document;
            a.Site.Version++;
            a.Site.UpdatedAt = DateTime.UtcNow;
            a.Site.UpdatedById = u.UserId();
            await db.SaveChangesAsync();
            return Results.Ok(new { version = a.Site.Version });
        });

        // ---------- members ----------
        g.MapGet("/{id:guid}/members", async (Guid id, ClaimsPrincipal u, AppDb db) =>
        {
            var a = await SiteAccess.Find(db, u, id);
            if (a is null) return Results.NotFound();
            var list = await db.SiteMembers.AsNoTracking().Where(m => m.SiteId == id).Include(m => m.User)
                .OrderBy(m => m.User.Email).ToListAsync();
            return Results.Ok(list.Select(m => new { userId = m.UserId, email = m.User.Email, displayName = m.User.DisplayName, role = RoleName(m.Role) }));
        });

        g.MapPost("/{id:guid}/members", async (Guid id, MemberRequest r, ClaimsPrincipal u, AppDb db) =>
        {
            var a = await SiteAccess.Find(db, u, id);
            if (a is null) return Results.NotFound();
            if (!a.IsOwner) return Results.Problem("Only an owner can manage members.", statusCode: 403);
            var user = await db.Users.FirstOrDefaultAsync(x => x.NormalizedEmail == (r.Email ?? "").Trim().ToUpperInvariant());
            if (user is null) return Results.Problem("No account with that email. Ask an administrator to create it first.", statusCode: 404);
            var role = r.Role == "owner" ? SiteRole.Owner : SiteRole.Editor;
            var m = await db.SiteMembers.FirstOrDefaultAsync(x => x.SiteId == id && x.UserId == user.Id);
            if (m is null) db.SiteMembers.Add(new SiteMember { SiteId = id, UserId = user.Id, Role = role });
            else m.Role = role;
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        g.MapDelete("/{id:guid}/members/{userId:guid}", async (Guid id, Guid userId, ClaimsPrincipal u, AppDb db) =>
        {
            var a = await SiteAccess.Find(db, u, id);
            if (a is null) return Results.NotFound();
            if (!a.IsOwner && userId != u.UserId()) return Results.Problem("Only an owner can remove other members.", statusCode: 403);
            var m = await db.SiteMembers.FirstOrDefaultAsync(x => x.SiteId == id && x.UserId == userId);
            if (m is null) return Results.NotFound();
            if (m.Role == SiteRole.Owner && !await db.SiteMembers.AnyAsync(x => x.SiteId == id && x.Role == SiteRole.Owner && x.UserId != userId))
                return Results.Problem("A site needs at least one owner.", statusCode: 409);
            db.SiteMembers.Remove(m);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });
    }
}
