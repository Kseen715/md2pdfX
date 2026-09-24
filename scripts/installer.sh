#!/bin/sh
# Установщик md2pdfX @VERSION@ для Linux @ARCH@: этот сценарий, за ним tar.gz
# с приложением (собирает scripts/build.js installer).
#
#   sh md2pdfX-linux-@ARCH@.run          — себе: ~/.local/share/md2pdfX, ~/.local/bin
#   sudo sh md2pdfX-linux-@ARCH@.run     — всем: /opt/md2pdfX, /usr/local/bin
#
# Удаление — uninstall.sh в каталоге установки.
set -e

case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) arch=$(uname -m) ;;
esac
if [ "$arch" != @ARCH@ ]; then
  echo "This installer is for @ARCH@, this machine is $arch." >&2
  exit 1
fi

if [ "$(id -u)" = 0 ]; then
  dest=/opt/md2pdfX bin=/usr/local/bin apps=/usr/share/applications
else
  data=${XDG_DATA_HOME:-$HOME/.local/share}
  dest=$data/md2pdfX bin=$HOME/.local/bin apps=$data/applications
fi

echo "Installing md2pdfX @VERSION@ to $dest"
rm -rf "$dest"
mkdir -p "$dest" "$bin" "$apps"
skip=$(awk '/^__PAYLOAD__$/ { print NR + 1; exit }' "$0")
tail -n +"$skip" "$0" | tar -xz --strip-components=1 -C "$dest"

# Песочнице Chromium без пространств имён пользователя (Ubuntu 24.04+) нужен
# setuid-помощник, а он работает, только если принадлежит root.
if [ "$(id -u)" = 0 ]; then
  chown root:root "$dest/chrome-sandbox"
  chmod 4755 "$dest/chrome-sandbox"
fi

ln -sf "$dest/md2pdfX" "$bin/md2pdfX"
ln -sf "$dest/md2pdf" "$bin/md2pdf"
cat > "$apps/md2pdfX.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=md2pdfX
Comment=Markdown to PDF
Exec="$dest/md2pdfX"
Icon=$dest/md2pdfX.png
Terminal=false
Categories=Office;Utility;
StartupWMClass=md2pdfX
EOF
cat > "$dest/uninstall.sh" <<EOF
#!/bin/sh
rm -f "$bin/md2pdfX" "$bin/md2pdf" "$apps/md2pdfX.desktop"
rm -rf "$dest"
echo "md2pdfX removed"
EOF
chmod +x "$dest/uninstall.sh"

echo "Done: md2pdfX (app), md2pdf (command) in $bin"
case ":$PATH:" in
  *":$bin:"*) ;;
  *) echo "Add $bin to PATH to run them by name." ;;
esac
echo "Uninstall: $dest/uninstall.sh"
exit 0
__PAYLOAD__
