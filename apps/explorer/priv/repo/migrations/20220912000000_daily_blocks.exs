defmodule Explorer.Repo.Migrations.DailyBlocks do
  use Ecto.Migration

  def change do
    alter table(:transaction_stats) do
      add(:number_of_blocks, :integer, default: 0)
    end
  end
end
