using Microsoft.Extensions.Options;
using Sitewright.Api.Auth;

namespace Sitewright.Api.Services;

/// <summary>All disk access for published sites and uploaded images. Paths are built only from validated slugs and GUIDs.</summary>
public class SiteFiles
{
    private readonly StorageOptions _o;
    public SiteFiles(IOptions<StorageOptions> o)
    {
        _o = o.Value;
        Directory.CreateDirectory(_o.PublishedDir);
        Directory.CreateDirectory(_o.AssetsDir);
    }

    public string PublicBase => _o.PublicSitesUrl.TrimEnd('/');
    public string SiteUrl(string slug) => $"{PublicBase}/{slug}/";
    public string AssetUrl(Guid siteId, string stored) => $"{PublicBase}/_assets/{siteId}/{stored}";

    private string Safe(string root, params string[] parts)
    {
        var full = Path.GetFullPath(Path.Combine(new[] { root }.Concat(parts).ToArray()));
        var rootFull = Path.GetFullPath(root) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(rootFull, StringComparison.Ordinal)) throw new InvalidOperationException("Path escapes storage root.");
        return full;
    }

    public string PublishedIndex(string slug) => Safe(_o.PublishedDir, slug, "index.html");
    public string AssetDir(Guid siteId) => Safe(_o.AssetsDir, siteId.ToString());
    public string AssetPath(Guid siteId, string stored) => Safe(_o.AssetsDir, siteId.ToString(), stored);

    /// <summary>Writes the new page next to the live one. Call Commit to swap it in, or Discard to drop it.</summary>
    public async Task<string> StageAsync(string slug, string html, CancellationToken ct)
    {
        var target = PublishedIndex(slug);
        Directory.CreateDirectory(Path.GetDirectoryName(target)!);
        var tmp = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
        await File.WriteAllTextAsync(tmp, html, ct);
        return tmp;
    }
    public void Commit(string slug, string staged) => File.Move(staged, PublishedIndex(slug), overwrite: true);
    public void Discard(string staged) { try { File.Delete(staged); } catch { } }

    public void DeletePublished(string slug)
    {
        var dir = Path.GetDirectoryName(PublishedIndex(slug))!;
        if (Directory.Exists(dir)) Directory.Delete(dir, true);
    }
    public void DeleteAssets(Guid siteId)
    {
        var dir = AssetDir(siteId);
        if (Directory.Exists(dir)) Directory.Delete(dir, true);
    }
}
