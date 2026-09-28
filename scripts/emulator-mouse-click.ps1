# Click visible Android Emulator window using Windows mouse (NOT adb input tap)
param(
  [int]$RelX,
  [int]$RelY
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseHelper {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public const int MOUSEEVENTF_LEFTDOWN = 0x02;
  public const int MOUSEEVENTF_LEFTUP = 0x04;
  public const int SW_RESTORE = 9;
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
  }
}
"@

$proc = Get-Process | Where-Object {
  $_.MainWindowTitle -match "Android Emulator" -and $_.MainWindowHandle -ne [IntPtr]::Zero
} | Select-Object -First 1

if (-not $proc) { throw "Android Emulator window not found" }

$hwnd = $proc.MainWindowHandle
if ([MouseHelper]::IsIconic($hwnd)) {
  [MouseHelper]::ShowWindow($hwnd, [MouseHelper]::SW_RESTORE) | Out-Null
  Start-Sleep -Milliseconds 400
}
[MouseHelper]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 400

$rect = New-Object MouseHelper+RECT
if (-not [MouseHelper]::GetWindowRect($hwnd, [ref]$rect)) {
  throw "GetWindowRect failed"
}

$clientW = $rect.Right - $rect.Left
$clientH = $rect.Bottom - $rect.Top
if ($clientW -lt 200 -or $clientH -lt 200) { throw "Emulator window too small: ${clientW}x${clientH}" }

$titleBar = 39
$scaleX = $clientW / 2400.0
$scaleY = ($clientH - $titleBar) / 1080.0
$absX = [int]($rect.Left + ($RelX * $scaleX))
$absY = [int]($rect.Top + $titleBar + ($RelY * $scaleY))

if ($absX -lt 0 -or $absY -lt 0) {
  throw "Computed invalid screen coords ($absX,$absY) from window ($($rect.Left),$($rect.Top),$($rect.Right),$($rect.Bottom))"
}

Write-Host "Click emulator($RelX,$RelY) -> screen($absX,$absY) window=$($proc.MainWindowTitle)"
[MouseHelper]::Click($absX, $absY)
