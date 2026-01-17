"""Upload footer image to hosting server via SFTP."""

import os
import sys
import paramiko
from pathlib import Path


def upload_image():
    """Upload Artboard 5.png to hosting server and save URL to .env"""

    print("=" * 80)
    print("YapMate Email Footer Image Upload")
    print("=" * 80)
    print("\nThis script will upload 'Artboard 5.png' to your hosting server.")
    print("You'll need your FTP/SFTP credentials.\n")

    # Check if image exists
    image_path = Path("Artboard 5.png")
    if not image_path.exists():
        print(f"❌ ERROR: 'Artboard 5.png' not found in current directory")
        print(f"   Current directory: {os.getcwd()}")
        print(f"   Please ensure the image file is in the project root.")
        sys.exit(1)

    # Get connection details from user
    print("SFTP Connection Details:")
    print("-" * 40)

    host = input("SFTP Host (e.g., ftp.yapmate.co.uk): ").strip()
    port = input("Port [22]: ").strip() or "22"
    username = input("Username: ").strip()
    password = input("Password: ").strip()

    print("\nRemote Path Configuration:")
    print("-" * 40)
    remote_dir = input("Target directory [/public_html/images/]: ").strip() or "/public_html/images/"

    print("\nPublic URL Configuration:")
    print("-" * 40)
    base_url = input("Public base URL (e.g., https://yapmate.co.uk/images/): ").strip()

    # Ensure base_url ends with /
    if not base_url.endswith('/'):
        base_url += '/'

    # Ensure remote_dir starts with /
    if not remote_dir.startswith('/'):
        remote_dir = '/' + remote_dir

    # Ensure remote_dir ends with /
    if not remote_dir.endswith('/'):
        remote_dir += '/'

    print("\n" + "=" * 80)
    print("UPLOAD SUMMARY")
    print("=" * 80)
    print(f"Local file:   {image_path}")
    print(f"SFTP Host:    {host}:{port}")
    print(f"Username:     {username}")
    print(f"Remote path:  {remote_dir}Artboard 5.png")
    print(f"Public URL:   {base_url}Artboard 5.png")
    print("=" * 80)

    confirm = input("\nProceed with upload? [y/N]: ").strip().lower()
    if confirm != 'y':
        print("❌ Upload cancelled.")
        sys.exit(0)

    # Connect via SFTP
    print("\n🔌 Connecting to SFTP server...")
    try:
        transport = paramiko.Transport((host, int(port)))
        transport.connect(username=username, password=password)
        sftp = paramiko.SFTPClient.from_transport(transport)
        print("✅ Connected successfully")
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        sys.exit(1)

    # Create remote directory if needed
    print(f"\n📁 Ensuring remote directory exists: {remote_dir}")
    try:
        # Try to create directory (will fail silently if exists)
        try:
            sftp.mkdir(remote_dir)
            print(f"   Created directory: {remote_dir}")
        except IOError:
            print(f"   Directory already exists: {remote_dir}")
    except Exception as e:
        print(f"   ⚠️  Could not create directory: {str(e)}")

    # Upload file
    remote_path = remote_dir + "Artboard 5.png"
    print(f"\n📤 Uploading image...")
    print(f"   Local:  {image_path}")
    print(f"   Remote: {remote_path}")

    try:
        sftp.put(str(image_path), remote_path)
        print("✅ Upload successful!")
    except Exception as e:
        print(f"❌ Upload failed: {str(e)}")
        sftp.close()
        transport.close()
        sys.exit(1)

    # Close connection
    sftp.close()
    transport.close()
    print("🔌 Connection closed")

    # Generate public URL
    public_url = base_url + "Artboard 5.png"

    print("\n" + "=" * 80)
    print("✅ UPLOAD COMPLETE")
    print("=" * 80)
    print(f"\nPublic URL: {public_url}")
    print("\nUpdating .env file...")

    # Update .env file
    env_path = Path(".env")
    if not env_path.exists():
        print("❌ ERROR: .env file not found")
        sys.exit(1)

    # Read current .env
    with open(env_path, 'r') as f:
        env_content = f.read()

    # Update EMAIL_FOOTER_IMAGE_URL
    if "EMAIL_FOOTER_IMAGE_URL=" in env_content:
        # Replace existing value
        lines = env_content.split('\n')
        new_lines = []
        for line in lines:
            if line.startswith("EMAIL_FOOTER_IMAGE_URL="):
                new_lines.append(f"EMAIL_FOOTER_IMAGE_URL={public_url}")
            else:
                new_lines.append(line)
        env_content = '\n'.join(new_lines)
    else:
        # Add new line
        env_content += f"\nEMAIL_FOOTER_IMAGE_URL={public_url}\n"

    # Write updated .env
    with open(env_path, 'w') as f:
        f.write(env_content)

    print("✅ .env updated with EMAIL_FOOTER_IMAGE_URL")
    print("\n" + "=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    print("1. Test the URL in your browser to verify the image loads")
    print("2. Run: python scripts/send_approved.py")
    print("=" * 80)


if __name__ == "__main__":
    upload_image()
