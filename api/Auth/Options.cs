namespace Sitewright.Api.Auth;

public class JwtOptions
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "sitewright";
    public int LifetimeHours { get; set; } = 8;
}

public class StorageOptions
{
    /// <summary>Where published sites are written: {PublishedDir}/{slug}/index.html</summary>
    public string PublishedDir { get; set; } = "/data/published";
    /// <summary>Where uploaded images live: {AssetsDir}/{siteId}/{file}</summary>
    public string AssetsDir { get; set; } = "/data/assets";
    /// <summary>Public origin that serves published sites and assets, for example http://localhost:8081</summary>
    public string PublicSitesUrl { get; set; } = "http://localhost:8081";
}

public class AuthOptions
{
    /// <summary>When false, only the very first user can self-register. Admins create everyone else.</summary>
    public bool AllowRegistration { get; set; }
    public string? SeedAdminEmail { get; set; }
    public string? SeedAdminPassword { get; set; }
}
