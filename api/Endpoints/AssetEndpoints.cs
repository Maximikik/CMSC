using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Sitewright.Api.Data;
using Sitewright.Api.Services;

namespace Sitewright.Api.Endpoints;

public static class AssetEndpoints
{
    const long MaxFile = 10 * 1024 * 1024;
    const long MaxPerSite = 500L * 1024 * 1024;

    /// <summary>Only formats that cannot carry script. SVG is left out on purpose.</summary>
    static string? Sniff(byte[] h)
    {
        if (h.Length >= 8 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47) return "png";
        if (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return "jpg";
        if (h.Length >= 6 && h[0] == 'G' && h[1] == 'I' && h[2] == 'F' && h[3] == '8') return "gif";
        if (h.Length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F' && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return "webp";
        return null;
    }
    static string Mime(string ext) => ext switch { "png" => "image/png", "jpg" => "image/jpeg", "gif" => "image/gif", _ => "image/webp" };

    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/sites/{id:guid}/assets").RequireAuthorization().WithTags("Images");

        g.MapGet("", async (Guid id, ClaimsPrincipal u, AppDb db, SiteFiles files) =>
        {
            if (await SiteAccess.Find(db, u, id) is null) return Results.NotFound();
            var list = await db.Assets.AsNoTracking().Where(a => a.SiteId == id).OrderByDescending(a => a.CreatedAt).ToListAsync();
            return Results.Ok(list.Select(a => new { id = a.Id, name = a.OriginalName, size = a.Size, url = files.AssetUrl(id, a.StoredName) }));
        });

        g.MapPost("", async (Guid id, IFormFile file, ClaimsPrincipal u, AppDb db, SiteFiles files, CancellationToken ct) =>
        {
            if (await SiteAccess.Find(db, u, id, ct) is null) return Results.NotFound();
            if (file.Length == 0 || file.Length > MaxFile) return Results.Problem("Images can be up to 10 MB.", statusCode: 400);
            if (await db.Assets.Where(a => a.SiteId == id).SumAsync(a => (long?)a.Size, ct) + file.Length > MaxPerSite)
                return Results.Problem("This site has used its 500 MB of image storage.", statusCode: 413);

            var head = new byte[16];
            int read;
            await using (var peek = file.OpenReadStream()) read = await peek.ReadAsync(head, ct);
            var ext = Sniff(head.AsSpan(0, read).ToArray());
            if (ext is null) return Results.Problem("Upload a PNG, JPEG, GIF or WebP image.", statusCode: 400);
            await using var input = file.OpenReadStream();

            var asset = new Asset
            {
                SiteId = id, StoredName = $"{Guid.NewGuid():N}.{ext}", ContentType = Mime(ext), Size = file.Length,
                OriginalName = Path.GetFileName(file.FileName) is { Length: > 0 } n ? n[..Math.Min(n.Length, 200)] : "image",
                UploadedById = u.UserId(),
            };
            Directory.CreateDirectory(files.AssetDir(id));
            await using (var output = File.Create(files.AssetPath(id, asset.StoredName)))
                await input.CopyToAsync(output, ct);
            db.Assets.Add(asset);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { id = asset.Id, name = asset.OriginalName, size = asset.Size, url = files.AssetUrl(id, asset.StoredName) });
        }).DisableAntiforgery();

        g.MapDelete("/{assetId:guid}", async (Guid id, Guid assetId, ClaimsPrincipal u, AppDb db, SiteFiles files) =>
        {
            if (await SiteAccess.Find(db, u, id) is null) return Results.NotFound();
            var a = await db.Assets.FirstOrDefaultAsync(x => x.Id == assetId && x.SiteId == id);
            if (a is null) return Results.NotFound();
            db.Assets.Remove(a);
            await db.SaveChangesAsync();
            try { File.Delete(files.AssetPath(id, a.StoredName)); } catch { }
            return Results.NoContent();
        });
    }
}
