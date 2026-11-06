using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
using Scalar.AspNetCore;

namespace Sitewright.Api.Services;

/// <summary>
/// Interactive API documentation. The OpenAPI document is generated from the endpoints themselves,
/// and Scalar renders it as a page where you can sign in and call every endpoint.
/// </summary>
public static class ApiDocs
{
    public const string JsonPath = "/api/openapi/{documentName}.json";
    public const string UiPath = "/api/docs";

    public static void AddApiDocs(this IServiceCollection services) =>
        services.AddOpenApi(o =>
        {
            o.AddDocumentTransformer((doc, _, _) =>
            {
                doc.Info.Title = "Sitewright API";
                doc.Info.Version = "v1";
                doc.Info.Description =
                    "Sign in with POST /api/auth/login, copy the token from the response, and paste it into Authorize (Bearer). " +
                    "The first account ever registered becomes the administrator.";
                doc.Components ??= new OpenApiComponents();
                doc.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
                doc.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    BearerFormat = "JWT",
                    Description = "The token returned by /api/auth/login or /api/auth/register.",
                };
                return Task.CompletedTask;
            });

            // Mark an operation as needing the token whenever its endpoint requires authorization.
            o.AddOperationTransformer((op, ctx, _) =>
            {
                var meta = ctx.Description.ActionDescriptor.EndpointMetadata;
                var needsAuth = meta.OfType<IAuthorizeData>().Any() && !meta.OfType<IAllowAnonymous>().Any();
                if (needsAuth && ctx.Document is not null)
                {
                    op.Security ??= new List<OpenApiSecurityRequirement>();
                    op.Security.Add(new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", ctx.Document)] = new List<string>() });
                }
                return Task.CompletedTask;
            });
        });

    public static void MapApiDocs(this WebApplication app)
    {
        app.MapOpenApi(JsonPath).AllowAnonymous();
        app.MapScalarApiReference(UiPath, o =>
        {
            o.WithTitle("Sitewright API");
            o.WithOpenApiRoutePattern(JsonPath);
            o.AddPreferredSecuritySchemes("Bearer");
        }).AllowAnonymous();
    }
}
