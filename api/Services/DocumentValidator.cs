using System.Text.RegularExpressions;
using System.Text.Json;

namespace Sitewright.Api.Services;

/// <summary>
/// The editor owns the document shape; the server only guards the structure it relies on,
/// so a broken or hostile client cannot store something the rest of the app cannot read.
/// </summary>
public static partial class DocumentValidator
{
    public const int MaxBytes = 6 * 1024 * 1024;
    public const int MaxPages = 100;
    public const int MaxBlocksPerPage = 500;

    public static readonly HashSet<string> BlockTypes = new()
    {
        "navbar","hero","split","heading","text","button","image","cards","faq","form","divider","spacer","popup","html","footer"
    };

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{0,47}$")]
    public static partial Regex SlugRx();

    public static string? Validate(JsonElement doc, out string raw)
    {
        raw = "";
        if (doc.ValueKind != JsonValueKind.Object) return "The site document must be an object.";
        raw = doc.GetRawText();
        if (raw.Length > MaxBytes) return "The site is too large to save (over 6 MB). Remove large images or custom HTML.";

        if (!doc.TryGetProperty("name", out var name) || name.ValueKind != JsonValueKind.String || name.GetString()!.Length > 120)
            return "The site needs a name of at most 120 characters.";
        if (!doc.TryGetProperty("theme", out var theme) || theme.ValueKind != JsonValueKind.Object)
            return "The site needs a theme.";
        if (!doc.TryGetProperty("pages", out var pages) || pages.ValueKind != JsonValueKind.Array)
            return "The site needs a list of pages.";

        var n = pages.GetArrayLength();
        if (n < 1 || n > MaxPages) return $"A site needs between 1 and {MaxPages} pages.";

        var ids = new HashSet<string>();
        var slugs = new HashSet<string>();
        foreach (var page in pages.EnumerateArray())
        {
            if (page.ValueKind != JsonValueKind.Object) return "Every page must be an object.";
            var id = Str(page, "id");
            var slug = Str(page, "slug");
            if (string.IsNullOrEmpty(id) || id.Length > 64) return "Every page needs an id.";
            if (!ids.Add(id)) return "Two pages share the same id.";
            if (string.IsNullOrEmpty(Str(page, "name"))) return "Every page needs a name.";
            if (slug is null || !SlugRx().IsMatch(slug)) return "Page addresses may only use lowercase letters, numbers and hyphens.";
            if (!slugs.Add(slug)) return $"Two pages use the address \"{slug}\".";
            if (!page.TryGetProperty("blocks", out var blocks) || blocks.ValueKind != JsonValueKind.Array)
                return "Every page needs a list of blocks.";
            if (blocks.GetArrayLength() > MaxBlocksPerPage) return $"A page can hold at most {MaxBlocksPerPage} elements.";
            var bids = new HashSet<string>();
            foreach (var b in blocks.EnumerateArray())
            {
                if (b.ValueKind != JsonValueKind.Object) return "Every element must be an object.";
                var type = Str(b, "type");
                if (type is null || !BlockTypes.Contains(type)) return $"Unknown element type \"{type}\".";
                var bid = Str(b, "id");
                if (string.IsNullOrEmpty(bid) || bid.Length > 64) return "Every element needs an id.";
                if (!bids.Add(bid)) return "Two elements on a page share the same id.";
            }
        }
        return null;
    }

    private static string? Str(JsonElement o, string key) =>
        o.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    public static readonly string[] ReservedSlugs = { "api", "admin", "_assets", "assets", "health", "static", "www" };

    public static string Slugify(string s)
    {
        var t = Regex.Replace(s.ToLowerInvariant().Trim(), "[^a-z0-9]+", "-").Trim('-');
        if (t.Length > 40) t = t[..40].Trim('-');
        return t.Length == 0 ? "site" : t;
    }
}
