"""Switch the generated Android project to a release keystore (ТЗ module 31).

Used by CI after `expo prebuild` when the ANDROID_KEYSTORE_* secrets exist.
Reads the keystore path and credentials from the environment, never prints them.
"""
import os
import re
import sys

gradle = sys.argv[1]  # apps/mobile/android/app/build.gradle
s = open(gradle).read()
block = """
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_FILE"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }"""
if 'ANDROID_KEYSTORE_FILE' not in s:
    s, n = re.subn(r'(signingConfigs\s*\{)', r'\1' + block, s, count=1)
    if n != 1:
        sys.exit('signingConfigs block not found')
    # Inside buildTypes.release use the release signing config instead of debug.
    s, n = re.subn(
        r'(buildTypes\s*\{.*?release\s*\{.*?)signingConfig\s+signingConfigs\.debug',
        r'\1signingConfig signingConfigs.release',
        s,
        count=1,
        flags=re.S,
    )
    if n != 1:
        sys.exit('release signingConfig line not found')
open(gradle, 'w').write(s)
print('release signing configured')
