"""Allow a desktop-size cover derivative alongside existing assets."""

from alembic import op

revision = "027_hike_cover_desktop"
down_revision = "026_hike_geo_label_entity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_hike_cover_asset_kind", "hike_cover_assets", type_="check")
    op.create_check_constraint(
        "ck_hike_cover_asset_kind",
        "hike_cover_assets",
        "kind IN ('original', 'card', 'mobile', 'desktop', 'wide')",
    )


def downgrade() -> None:
    op.execute("DELETE FROM hike_cover_assets WHERE kind IN ('desktop', 'wide')")
    op.drop_constraint("ck_hike_cover_asset_kind", "hike_cover_assets", type_="check")
    op.create_check_constraint(
        "ck_hike_cover_asset_kind", "hike_cover_assets", "kind IN ('original', 'card', 'mobile')"
    )
