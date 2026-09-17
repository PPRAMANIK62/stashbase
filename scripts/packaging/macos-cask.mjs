export function macCaskContent({ cask, version, productName, description, repo, appId, checksums }) {
  if (!checksums.arm64 || !checksums.x64) throw new Error('Homebrew requires both macOS architectures');
  return `cask "${cask}" do
  arch arm: "arm64", intel: "x64"
  version "${version}"
  sha256 arm: "${checksums.arm64}",
         intel: "${checksums.x64}"

  url "https://github.com/${repo}/releases/download/v#{version}/${productName}-#{version}-mac-#{arch}.dmg"
  name "${productName}"
  desc "${description}"
  homepage "https://github.com/${repo}"
  depends_on macos: ">= :monterey"

  app "${productName}.app"

  zap trash: [
    "~/.stashbase",
    "~/Library/Application Support/${productName}",
    "~/Library/Logs/${productName}",
    "~/Library/Preferences/${appId}.plist",
    "~/Library/Saved Application State/${appId}.savedState",
  ]
end
`;
}
