#ifndef AppVersion
  #error AppVersion is required
#endif
[Setup]
AppId={{F08D55A4-6584-46E5-B8EB-2069DDA9E886}
AppName=Command Desk
AppVersion={#AppVersion}
AppPublisher=FermionaPlay
AppPublisherURL=https://github.com/foolka/command-desk
DefaultDirName={localappdata}\Programs\Command Desk
DisableDirPage=yes
UsePreviousAppDir=no
DefaultGroupName=Command Desk
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
DisableProgramGroupPage=yes
WizardStyle=modern
SetupIconFile={#PackageDir}\resources\app.ico
UninstallDisplayIcon={app}\CommandDesk.exe
OutputDir={#OutputDir}
OutputBaseFilename=command-desk-{#AppVersion}-windows-x64-setup
Compression=lzma2
SolidCompression=yes
CloseApplications=no
RestartApplications=no
[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "ru"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "uk"; MessagesFile: "compiler:Languages\Ukrainian.isl"
[Tasks]
Name: "desktopicon"; Description: "Desktop shortcut / Ярлык на рабочем столе"
[Files]
Source: "{#PackageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\Command Desk"; Filename: "{app}\CommandDesk.exe"; WorkingDir: "{app}"; AppUserModelID: "com.fermionaplay.commanddesk"
Name: "{autodesktop}\Command Desk"; Filename: "{app}\CommandDesk.exe"; WorkingDir: "{app}"; AppUserModelID: "com.fermionaplay.commanddesk"; Tasks: desktopicon
[Run]
Filename: "{app}\CommandDesk.exe"; Description: "Launch Command Desk"; Flags: postinstall nowait skipifsilent
[Code]
function ProcessGuard(): String;
var Locator, Services, Items: Variant;
begin
  Result := '';
  try
    Locator := CreateOleObject('WbemScripting.SWbemLocator');
    Services := Locator.ConnectServer('.', 'root\CIMV2');
    Items := Services.ExecQuery('SELECT ProcessId FROM Win32_Process WHERE Name = ''CommandDesk.exe''');
    if Items.Count > 0 then Result := 'Close Command Desk before installing. Your data will be kept.';
  except
    Result := 'Could not check running applications. Installation cancelled.';
  end;
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := ProcessGuard();
end;
function InitializeUninstall(): Boolean;
var Reason: String;
begin
  Reason := ProcessGuard(); Result := Reason = '';
  if not Result then MsgBox(Reason, mbInformation, MB_OK);
end;
