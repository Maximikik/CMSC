using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Sitewright.Api.Data;

public class AppDb(DbContextOptions<AppDb> options) : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Site> Sites => Set<Site>();
    public DbSet<SiteMember> SiteMembers => Set<SiteMember>();
    public DbSet<SiteVersion> SiteVersions => Set<SiteVersion>();
    public DbSet<Asset> Assets => Set<Asset>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<Site>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(120).IsRequired();
            e.Property(x => x.Slug).HasMaxLength(48).IsRequired();
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Draft).HasColumnType("jsonb");
            e.Property(x => x.Published).HasColumnType("jsonb");
            e.Property(x => x.Version).IsConcurrencyToken();
        });

        b.Entity<SiteMember>(e =>
        {
            e.HasKey(x => new { x.SiteId, x.UserId });
            e.HasOne(x => x.Site).WithMany(s => s.Members).HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.UserId);
        });

        b.Entity<SiteVersion>(e =>
        {
            e.Property(x => x.Document).HasColumnType("jsonb");
            e.Property(x => x.Note).HasMaxLength(300);
            e.HasOne<Site>().WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.SiteId, x.Number }).IsUnique();
        });

        b.Entity<Asset>(e =>
        {
            e.Property(x => x.StoredName).HasMaxLength(80).IsRequired();
            e.Property(x => x.OriginalName).HasMaxLength(200);
            e.Property(x => x.ContentType).HasMaxLength(60);
            e.HasOne<Site>().WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.SiteId);
        });
    }
}
