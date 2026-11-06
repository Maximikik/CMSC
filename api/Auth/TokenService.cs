using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Sitewright.Api.Data;

namespace Sitewright.Api.Auth;

public class TokenService(IOptions<JwtOptions> opt)
{
    private readonly JwtOptions _o = opt.Value;

    public static SymmetricSecurityKey KeyFrom(string key) => new(Encoding.UTF8.GetBytes(key));

    public string Create(AppUser user, bool isAdmin)
    {
        var claims = new List<Claim>
        {
            new("sub", user.Id.ToString()),
            new("email", user.Email ?? ""),
            new("name", user.DisplayName),
        };
        if (isAdmin) claims.Add(new Claim("role", "Admin"));
        var token = new JwtSecurityToken(
            issuer: _o.Issuer,
            audience: _o.Issuer,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(_o.LifetimeHours),
            signingCredentials: new SigningCredentials(KeyFrom(_o.Key), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
