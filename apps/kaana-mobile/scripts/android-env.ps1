# Use Temurin JDK 17 for Android builds (Gradle does not support JDK 25 yet)
$env:JAVA_HOME = "C:\Users\kanas\Kaana-foods\.tools\jdk-17"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

Write-Host "JAVA_HOME=$env:JAVA_HOME"
java -version
