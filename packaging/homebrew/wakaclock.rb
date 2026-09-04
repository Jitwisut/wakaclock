class Wakaclock < Formula
  desc "Metadata-only developer time tracking with accuracy-first AI diagnostics"
  homepage "https://github.com/Jitwisut/wakaclock"
  url "https://github.com/Jitwisut/wakaclock/archive/refs/tags/v0.1.0.tar.gz"
  license "MIT"

  depends_on "rust" => :build

  def install
    system "cargo", "build", "--release", "--locked", "-p", "wakaclock-cli",
      "--manifest-path", "backend/api/Cargo.toml"
    bin.install "backend/api/target/release/wakaclock"
  end

  def post_install
    # Only the AtoAxis-owned watcher service is reconciled here. AI adapter
    # configuration still requires explicit CLI or VS Code consent.
    system bin/"wakaclock", "agent", "install", "--json"
  end

  test do
    assert_match "Wakaclock CLI Hub", shell_output("#{bin}/wakaclock --help")
    assert_match "diagnostics", shell_output("#{bin}/wakaclock ai doctor --help")
  end
end
