using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.IdentityModel.Tokens;
using Sitewright.Api.Auth;
using Sitewright.Api.Data;
using Sitewright.Api.Endpoints;
using Sitewright.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection("Storage"));
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection("Auth"));

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
if (jwt.Key.Length < 32)
    throw new InvalidOperationException("Jwt:Key must be set to a random string of at least 32 characters (environment variable Jwt__Key).");

builder.Services.AddDbContext<AppDb>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("ConnectionStrings:Default is not set.")));

// Keys that protect one-time tokens (admin password resets). Kept on a volume so they survive container restarts.
var keysDir = builder.Configuration["Storage:KeysDir"] ?? "/keys";
builder.Services.AddDataProtection().SetApplicationName("sitewright").PersistKeysToFileSystem(new DirectoryInfo(keysDir));

builder.Services.AddIdentityCore<AppUser>(o =>
{
    o.Password.RequiredLength = 10;
    o.Password.RequireNonAlphanumeric = false;
    o.Password.RequireUppercase = false;
    o.Password.RequireLowercase = false;
    o.Password.RequireDigit = false;
    o.User.RequireUniqueEmail = true;
    o.Lockout.MaxFailedAccessAttempts = 8;
    o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
}).AddRoles<IdentityRole<Guid>>().AddEntityFrameworkStores<AppDb>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = jwt.Issuer,
        ValidAudience = jwt.Issuer,
        IssuerSigningKey = TokenService.KeyFrom(jwt.Key),
        NameClaimType = "name",
        RoleClaimType = "role",
        ClockSkew = TimeSpan.FromMinutes(1),
    };
    // Re-read the account on every request, so deleting a user or removing admin rights takes effect immediately.
    o.Events = new JwtBearerEvents
    {
        OnTokenValidated = async ctx =>
        {
            var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDb>();
            var id = Guid.Parse(ctx.Principal!.FindFirstValue("sub")!);
            if (!await db.Users.AnyAsync(u => u.Id == id)) { ctx.Fail("Account no longer exists."); return; }
            var isAdmin = await (from ur in db.UserRoles join r in db.Roles on ur.RoleId equals r.Id
                                 where ur.UserId == id && r.Name == "Admin" select ur).AnyAsync();
            var identity = (ClaimsIdentity)ctx.Principal!.Identity!;
            foreach (var c in identity.FindAll("role").ToList()) identity.RemoveClaim(c);
            if (isAdmin) identity.AddClaim(new Claim("role", "Admin"));
        },
    };
});
builder.Services.AddAuthorization();

builder.Services.AddApiDocs();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<SiteFiles>();

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // The API is only reachable through the nginx container, so its forwarded headers are trusted.
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o => o.MultipartBodyLengthLimit = 12 * 1024 * 1024);
builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = 24 * 1024 * 1024);

var app = builder.Build();

app.UseForwardedHeaders();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", async (AppDb db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "ok" }) : Results.StatusCode(503)).AllowAnonymous().WithTags("Health").WithSummary("Is the API up and the database reachable?");
// Interactive docs at /api/docs. On by default in Development; elsewhere set Docs__Enabled=true.
if (app.Configuration.GetValue("Docs:Enabled", app.Environment.IsDevelopment())) app.MapApiDocs();

AuthEndpoints.Map(app);
UserEndpoints.Map(app);
SiteEndpoints.Map(app);
AssetEndpoints.Map(app);

await Startup.InitAsync(app);
app.Run();

public partial class Program { }

static class Startup
{
    public static async Task InitAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var log = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();

        // The database container may still be starting. Retry for about a minute before giving up.
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                // Create the database itself when it does not exist yet (needs a role with CREATEDB), then bring the schema up to date.
                var creator = db.GetService<IRelationalDatabaseCreator>();
                if (!await creator.ExistsAsync())
                {
                    log.LogInformation("Database does not exist. Creating it.");
                    await creator.CreateAsync();
                }
                await db.Database.MigrateAsync();
                break;
            }
            catch (Exception e) when (attempt < 20)
            {
                log.LogWarning("Database not ready (attempt {Attempt}): {Message}", attempt, e.GetBaseException().Message);
                await Task.Delay(3000);
            }
        }

        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        if (!await roles.RoleExistsAsync("Admin")) await roles.CreateAsync(new IdentityRole<Guid>("Admin"));

        var auth = app.Configuration.GetSection("Auth").Get<AuthOptions>() ?? new AuthOptions();
        if (!string.IsNullOrWhiteSpace(auth.SeedAdminEmail) && !string.IsNullOrWhiteSpace(auth.SeedAdminPassword) && !await db.Users.AnyAsync())
        {
            var um = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
            var admin = new AppUser { UserName = auth.SeedAdminEmail, Email = auth.SeedAdminEmail, DisplayName = "Administrator" };
            var res = await um.CreateAsync(admin, auth.SeedAdminPassword);
            if (res.Succeeded) { await um.AddToRoleAsync(admin, "Admin"); log.LogInformation("Created the first administrator {Email}.", auth.SeedAdminEmail); }
            else log.LogError("Could not create the seed administrator: {Errors}", string.Join(" ", res.Errors.Select(e => e.Description)));
        }
    }
}
