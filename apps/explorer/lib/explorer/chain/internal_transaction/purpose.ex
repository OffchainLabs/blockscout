defmodule Explorer.Chain.InternalTransaction.Purpose do
  @moduledoc """
  Internal transaction purposes
  """

  use Ecto.Type

  @type t :: :fee_collection | :fee_payment | :deposit | :escrow | :prepaid | :refund | :l1_send | :general

  @impl Ecto.Type
  @spec cast(term()) :: {:ok, t()} | :error
  def cast(t) when t in ~w(fee_collection fee_payment deposit escrow prepaid refund l1_send general)a, do: {:ok, t}
  def cast("feeCollection"), do: {:ok, :fee_collection}
  def cast("feePayment"), do: {:ok, :fee_payment}
  def cast("deposit"), do: {:ok, :deposit}
  def cast("escrow"), do: {:ok, :escrow}
  def cast("prepaid"), do: {:ok, :prepaid}
  def cast("refund"), do: {:ok, :refund}
  def cast("l1Send"), do: {:ok, :l1_send}
  def cast("general"), do: {:ok, :general}
  def cast(_), do: :error

  @impl Ecto.Type
  @spec dump(term()) :: {:ok, String.t()} | :error
  def dump(:fee_collection), do: {:ok, "feeCollection"}
  def dump(:fee_payment), do: {:ok, "feePayment"}
  def dump(:deposit), do: {:ok, "deposit"}
  def dump(:escrow), do: {:ok, "escrow"}
  def dump(:prepaid), do: {:ok, "prepaid"}
  def dump(:refund), do: {:ok, "refund"}
  def dump(:l1_send), do: {:ok, "l1Send"}
  def dump(:general), do: {:ok, "general"}
  def dump(_), do: :error

  @impl Ecto.Type
  @spec load(term()) :: {:ok, t()} | :error
  def load("feeCollection"), do: {:ok, :fee_collection}
  def load("feePayment"), do: {:ok, :fee_payment}
  def load("deposit"), do: {:ok, :deposit}
  def load("escrow"), do: {:ok, :escrow}
  def load("prepaid"), do: {:ok, :prepaid}
  def load("refund"), do: {:ok, :refund}
  def load("l1Send"), do: {:ok, :l1_send}
  def load("general"), do: {:ok, :general}

  @doc """
  The underlying database type: `:string`
  """
  @impl Ecto.Type
  @spec type() :: :string
  def type, do: :string
end
