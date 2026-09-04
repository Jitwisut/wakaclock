class Wakaclock < Formula
  desc "Metadata-only developer time tracking with universal AI attribution"
  homepage "https://github.com/Jitwisut/wakaclock"
  url "https://github.com/Jitwisut/wakaclock/archive/refs/tags/v0.1.0.tar.gz"
  license "MIT"

  depends_on "rust" => :build

  def install
    system "cargo", "build", "--release", "--locked", "-p", "wakaclock-cli", "--manifest-path", "backend/api/Cargo.toml"
    bin.install "backend/api/target/release/wakaclock"
  end

  def post_install
    # Service registration is per-user and idempotent. It never edits an agent
    # config; hook setup remains behind the CLI's explicit consent file.
    system bin/"wakaclock", "broker", "install", "--json"
  end

  test do
    assert_match "Wakaclock CLI Hub", shell_output("#{bin}/wakaclock --help")
  end
end
