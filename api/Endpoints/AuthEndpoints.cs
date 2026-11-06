using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Sitewright.Api.Auth;
using Sitewright.Api.Data;
using Sitewright.Api.Services;

namespace Sitewright.Api.Endpoints;

public record RegisterRequest(string Email, string Password, string? DisplayName);
public record LoginRequest(string Email, string Password);
public record ChangePasswordRequest(string Current, string New);
public record UserDto(Guid Id, string Email, string DisplayName, bool IsAdmin);

public static class AuthEndpoints
{
    public static async Task<UserDto> ToDto(UserManager<AppUser> um, AppUser u) =>
        new(u.Id, u.Email ?? "", u.DisplayName, await um.IsInRoleAsync(u, "Admin"));

    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/auth");

        g.MapGet("/status", async (AppDb db, IOptions<AuthOptions> o) =>
            Results.Ok(new { hasUsers = await db.Users.AnyAsync(), allowRegistration = o.Value.AllowRegistration }));

        g.MapPost("/register", async (RegisterRequest r, UserManager<AppUser> um, AppDb db, TokenService tokens, IOptions<AuthOptions> o) =>
        {
            var first = !await db.Users.AnyAsync();
            if (!first && !o.Value.AllowRegistration)
                return Results.Problem("Sign-up is closed. Ask an administrator to create your account.", statusCode: 403);
            if (!new EmailAddressAttribute().IsValid(r.Email)) return Results.Problem("Enter a valid email address.", statusCode: 400);

            var user = new AppUser { UserName = r.Email.Trim(), Email = r.Email.Trim(), DisplayName = (r.DisplayName ?? "").Trim() };
            if (user.DisplayName.Length == 0) user.DisplayName = user.Email.Split('@')[0];
            var res = await um.CreateAsync(user, r.Password);
            if (!res.Succeeded) return Results.Problem(string.Join(" ", res.Errors.Select(e => e.Description)), statusCode: 400);
            if (first) await um.AddToRoleAsync(user, "Admin");
            var dto = await ToDto(um, user);
            return Results.Ok(new { token = tokens.Create(user, dto.IsAdmin), user = dto });
        }).RequireRateLimiting("auth");

        g.MapPost("/login", async (LoginRequest r, UserManager<AppUser> um, TokenService tokens) =>
        {
            var user = await um.FindByEmailAsync(r.Email.Trim());
            const string bad = "Email or password is not correct.";
            if (user is null) return Results.Problem(bad, statusCode: 401);
            if (await um.IsLockedOutAsync(user)) return Results.Problem("Too many failed attempts. Try again in a few minutes.", statusCode: 429);
            if (!await um.CheckPasswordAsync(user, r.Password))
            {
                await um.AccessFailedAsync(user);
                return Results.Problem(bad, statusCode: 401);
            }
            await um.ResetAccessFailedCountAsync(user);
            var dto = await ToDto(um, user);
            return Results.Ok(new { token = tokens.Create(user, dto.IsAdmin), user = dto });
        }).RequireRateLimiting("auth");

        g.MapGet("/me", async (ClaimsPrincipal p, UserManager<AppUser> um) =>
        {
            var u = await um.FindByIdAsync(p.UserId().ToString());
            return u is null ? Results.Unauthorized() : Results.Ok(await ToDto(um, u));
        }).RequireAuthorization();

        g.MapPost("/password", async (ChangePasswordRequest r, ClaimsPrincipal p, UserManager<AppUser> um) =>
        {
            var u = await um.FindByIdAsync(p.UserId().ToString());
            if (u is null) return Results.Unauthorized();
            var res = await um.ChangePasswordAsync(u, r.Current, r.New);
            return res.Succeeded ? Results.NoContent() : Results.Problem(string.Join(" ", res.Errors.Select(e => e.Description)), statusCode: 400);
        }).RequireAuthorization().RequireRateLimiting("auth");
    }
}

public static class UserEndpoints
{
    public record CreateUserRequest(string Email, string Password, string? DisplayName, bool IsAdmin);
    public record ResetPasswordRequest(string Password);

    public static void Map(WebApplication app)
    {
        var g = app.MapGroup("/api/users").RequireAuthorization(p => p.RequireClaim("role", "Admin"));

        g.MapGet("", async (UserManager<AppUser> um, AppDb db) =>
        {
            var admins = (await um.GetUsersInRoleAsync("Admin")).Select(a => a.Id).ToHashSet();
            var users = await db.Users.AsNoTracking().OrderBy(u => u.Email).ToListAsync();
            return users.Select(u => new UserDto(u.Id, u.Email ?? "", u.DisplayName, admins.Contains(u.Id)));
        });

        g.MapPost("", async (CreateUserRequest r, UserManager<AppUser> um) =>
        {
            if (!new EmailAddressAttribute().IsValid(r.Email)) return Results.Problem("Enter a valid email address.", statusCode: 400);
            var user = new AppUser { UserName = r.Email.Trim(), Email = r.Email.Trim(), DisplayName = string.IsNullOrWhiteSpace(r.DisplayName) ? r.Email.Split('@')[0] : r.DisplayName.Trim() };
            var res = await um.CreateAsync(user, r.Password);
            if (!res.Succeeded) return Results.Problem(string.Join(" ", res.Errors.Select(e => e.Description)), statusCode: 400);
            if (r.IsAdmin) await um.AddToRoleAsync(user, "Admin");
            return Results.Ok(await AuthEndpoints.ToDto(um, user));
        });

        g.MapPut("/{id:guid}/password", async (Guid id, ResetPasswordRequest r, UserManager<AppUser> um) =>
        {
            var u = await um.FindByIdAsync(id.ToString());
            if (u is null) return Results.NotFound();
            var token = await um.GeneratePasswordResetTokenAsync(u);
            var res = await um.ResetPasswordAsync(u, token, r.Password);
            return res.Succeeded ? Results.NoContent() : Results.Problem(string.Join(" ", res.Errors.Select(e => e.Description)), statusCode: 400);
        });

        g.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal p, UserManager<AppUser> um, AppDb db) =>
        {
            if (id == p.UserId()) return Results.Problem("You cannot delete your own account.", statusCode: 400);
            var u = await um.FindByIdAsync(id.ToString());
            if (u is null) return Results.NotFound();
            // Sites where this user is the only owner would be orphaned: refuse instead.
            var orphan = await db.SiteMembers.Where(m => m.UserId == id && m.Role == SiteRole.Owner)
                .AnyAsync(m => !db.SiteMembers.Any(o => o.SiteId == m.SiteId && o.Role == SiteRole.Owner && o.UserId != id));
            if (orphan) return Results.Problem("This user is the only owner of at least one site. Add another owner first.", statusCode: 409);
            await um.DeleteAsync(u);
            return Results.NoContent();
        });
    }
}
