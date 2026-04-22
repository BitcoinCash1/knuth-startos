<p align="center">
  <img src="icon.svg" alt="Knuth logo" width="21%">
</p>

# Knuth StartOS Package

This package provides **Knuth (`kth`) v0.80.0** as a StartOS service — a
high-performance, C++23 **Bitcoin Cash** full node implementation.

StartOS package ID: `knuth`.

> Knuth is developed by the [k-nuth](https://github.com/k-nuth) team. It is an
> independent BCH node implementation, **not** a BCHN fork or BCHN-compatible
> flavor. It has its own codebase, database format (LMDB), configuration
> (`kth.cfg`), and on-disk layout.

## About Knuth

Knuth (`kth`) is a modern Bitcoin Cash full node written in C++23. It focuses
on performance, modularity, and low resource use, and is a strong fit for
wallets, exchanges, explorers, and miners that need a fast, embeddable P2P
node.

This package runs the **P2P node only**. Knuth does **not** expose a
JSON-RPC server — if you need RPC, use Bitcoin Cash Node (`bitcoincashd`) or
Bitcoin Cash Daemon (`bchd`) instead.

## Features

- **C++23 full node** — aggressive micro-architectural optimizations
  (prebuilt Haswell-tuned binary for x86_64 via the upstream Conan cache).
- **LMDB storage engine** — memory-mapped blockchain database for low-overhead
  block and UTXO access.
- **BCH consensus** — tracks the Bitcoin Cash protocol, including the current
  network upgrade.
- **Peer connections dashboard widget** — live count of established inbound /
  outbound TCP connections on the P2P port, queried via `ss` inside the
  container.
- **Sync progress widget** — block height plus percentage of the rough chain
  tip (derived from the `kth` debug log; Knuth does not expose an RPC height).
- **Double-Spend Proofs (DSP)** — accepted and relayed (always on).
- **Compact block relay (high-bandwidth)** — advertised by default.
- **UPnP** — NAT port mapping for inbound P2P reachability (on by default).
- **Tor (optional)** — inbound onion reachability via the StartOS Tor
  package. Note: Knuth does not natively consume a SOCKS proxy in this
  package; the Tor dependency currently only affects onion-inbound exposure.

## Network Ports

Knuth runs **mainnet** by default. Network is selectable (mainnet / chipnet /
testnet4).

| Port  | Protocol | Purpose                                          |
|-------|----------|--------------------------------------------------|
| 8333  | TCP      | P2P network connections (mainnet)                |
| 48333 | TCP      | P2P network connections (chipnet, when selected) |
| 28333 | TCP      | P2P network connections (testnet4, when selected)|

There are no RPC, ZMQ, or HTTP ports — Knuth is P2P-only in this package.

## Architectures

CI publishes signed `.s9pk` files for:

| Arch     | Runner                | Notes                                                              |
|----------|-----------------------|--------------------------------------------------------------------|
| x86_64   | `ubuntu-24.04`        | Uses upstream Knuth Conan prebuilts (fast).                        |
| aarch64  | `ubuntu-24.04-arm`    | No upstream prebuilts — builds `boost`, `lmdb`, `openssl`, `kth` from source. |
| riscv64  | `ubuntu-24.04` + QEMU | Experimental. Full source build under emulation; may exceed the 6-hour GitHub job limit. Marked non-blocking so a failing riscv64 job does not gate the other two. |

`emulateMissingAs: x86_64` is set as a runtime fallback.

## Building from Source

1. Set up your [StartOS SDK environment](https://docs.start9.com/latest/developer-guide/sdk/installing-the-sdk).
2. Clone this repository and `cd` into it.
3. Run `make` (builds all architectures listed in `ARCHES`), or a single
   arch: `make x86_64` / `make aarch64` / `make riscv64`.
4. The resulting `.s9pk` can be side-loaded into StartOS.

## Configuration

Knuth uses a single `kth.cfg` file (Boost property-tree INI with `[section]`
headers). The package surfaces the relevant knobs through StartOS actions
grouped under **Configuration**:

- **Network** — Select mainnet / chipnet / testnet4.
- **Peers & Network** — Network threads, inbound/outbound peer counts,
  handshake / heartbeat / inactivity / expiration timers, host-pool capacity,
  UPnP, hosts-cache file, user-agent override.
- **Node & Mempool Settings** — Validation cores, high-priority validation,
  libconsensus toggle, compact-block high-bandwidth toggle, block-poll
  interval, mempool capacity, LMDB max size, reorg-pool limit, database
  safe-mode, cache capacity, verbose logging, log rotation size, Tor
  advertisement, clearnet-inbound advertisement.
- **Reindex Blockchain** — One-shot action that deletes the LMDB directory so
  the next start re-runs `kth`'s initchain.
- **Delete Peers** — One-shot action that clears `hosts.cache` so Knuth
  rediscovers peers from DNS seeds.

### Always-on flags

A few BCH-network-hygiene flags are enforced on every boot and have **no**
user toggle in the UI:

| Flag                          | Value | Reason                                                |
|-------------------------------|-------|-------------------------------------------------------|
| `node.relay_transactions`     | true  | Relay unconfirmed transactions (required for BCH).    |
| `node.refresh_transactions`   | true  | Refresh mempool on new connections.                   |
| `node.ds_proofs_enabled`      | true  | Accept and relay double-spend proofs.                 |

## Dependencies

- **Tor** *(optional)* — for onion-inbound reachability. When the Tor package
  is installed and running, Knuth advertises the onion endpoint. Otherwise
  peers are reached over clearnet only.

## Data Directory Layout

Under `/data`:

- `kth.cfg` — configuration file (managed by StartOS).
- `blockchain/` — LMDB database directory. **Not** pre-created — kth's
  `verify_directory()` treats any existing dbDir as initialized, so we let
  kth create it itself on first run to trigger `do_initchain`.
- `log/node-bch-mainnet-debug.log` — rotating debug log.
- `log/archive/` — rotated log archives.
- `hosts.cache` — peer-address cache.

On btrfs, `/data` is marked NoCOW (`chattr +C`) at service start; the
kth-created `blockchain/` inherits that attribute.

## Support

- **Knuth project**: https://kth.cash
- **Upstream source**: https://github.com/k-nuth/kth
- **Package issues**: https://github.com/BitcoinCash1/knuth-startos/issues

## License

This package is released under the MIT license. See [LICENSE](LICENSE).
For a complete list of build options, see
[StartOS Packaging Guide](https://docs.start9.com/packaging-guide/building.html).

