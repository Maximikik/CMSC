using Microsoft.AspNetCore.Identity;

namespace Sitewright.Api.Data;

public class AppUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum SiteRole { Editor = 0, Owner = 1 }

public class Site
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";

    /// <summary>The working copy of the whole site (theme, pages, blocks) as JSON.</summary>
    public string Draft { get; set; } = "{}";
    /// <summary>Bumped on every draft save. Clients send the version they started from, so two editors cannot silently overwrite each other.</summary>
    public int Version { get; set; } = 1;

    /// <summary>Snapshot of the draft that is currently live. Null when the site is not published.</summary>
    public string? Published { get; set; }
    public DateTime? PublishedAt { get; set; }
    public int? PublishedVersionNumber { get; set; }
    /// <summary>The draft Version that was live when published. If Version is higher, there are unpublished changes.</summary>
    public int? PublishedDraftVersion { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public Guid? UpdatedById { get; set; }

    public List<SiteMember> Members { get; set; } = new();
}

public class SiteMember
{
    public Guid SiteId { get; set; }
    public Site Site { get; set; } = null!;
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = null!;
    public SiteRole Role { get; set; }
}

/// <summary>One row per publish. Lets you look back and restore an older version into the draft.</summary>
public class SiteVersion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SiteId { get; set; }
    public int Number { get; set; }
    public string Document { get; set; } = "{}";
    public string? Note { get; set; }
    public Guid? CreatedById { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Asset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SiteId { get; set; }
    public string StoredName { get; set; } = "";
    public string OriginalName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long Size { get; set; }
    public Guid? UploadedById { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
