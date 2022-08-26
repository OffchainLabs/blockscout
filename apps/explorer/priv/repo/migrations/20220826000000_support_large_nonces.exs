defmodule Explorer.Repo.Migrations.SupportLargeNonces do
  use Ecto.Migration

  def change do
    alter table(:transactions) do
      modify(:nonce, :numeric, precision: 100, null: false)
    end
  end
end
