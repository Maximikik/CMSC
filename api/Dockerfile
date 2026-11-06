# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# Restore first so this layer is cached until the package list changes.
COPY Sitewright.Api.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
# Published sites and uploaded images live on a volume shared with the web container.
RUN mkdir -p /data/published /data/assets /keys && chown -R app:app /data /keys
COPY --from=build /out .
USER app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Sitewright.Api.dll"]
