; Установщик md2pdfX для Windows: на пользователя, без прав администратора.
; Собирает scripts/build.js installer:
;   makensis /DVERSION=… /DSRC=<приложение> /DOUT=<setup.exe> installer.nsi
; Каталог приложения попадает в PATH пользователя: там md2pdf.cmd — команда.
Unicode true
!include MUI2.nsh

!define UNINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\md2pdfX"
; PowerShell: PATH пользователя без каталога установки (и пустых элементов).
!define PATH_WITHOUT "$$d='$INSTDIR'; $$l=@([string][Environment]::GetEnvironmentVariable('Path','User') -split ';' | ? { $$_ -and $$_ -ne $$d })"

Name "md2pdfX"
OutFile "${OUT}"
RequestExecutionLevel user
; ponytail: каталог не выбирается — удаление стирает его целиком.
InstallDir "$LOCALAPPDATA\Programs\md2pdfX"

!define MUI_ICON "${__FILEDIR__}\..\images\icon.ico"
!define MUI_UNICON "${__FILEDIR__}\..\images\uninstall.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\md2pdfX.exe"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  CreateShortcut "$SMPROGRAMS\md2pdfX.lnk" "$INSTDIR\md2pdfX.exe"
  WriteRegStr HKCU "${UNINST}" "DisplayName" "md2pdfX"
  WriteRegStr HKCU "${UNINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST}" "DisplayIcon" "$INSTDIR\md2pdfX.exe"
  WriteRegStr HKCU "${UNINST}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKCU "${UNINST}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST}" "NoRepair" 1
  nsExec::ExecToLog `powershell -NoProfile -Command "${PATH_WITHOUT}; [Environment]::SetEnvironmentVariable('Path', (@($$l) + $$d) -join ';', 'User')"`
SectionEnd

Section Uninstall
  nsExec::ExecToLog `powershell -NoProfile -Command "${PATH_WITHOUT}; [Environment]::SetEnvironmentVariable('Path', $$l -join ';', 'User')"`
  Delete "$SMPROGRAMS\md2pdfX.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST}"
SectionEnd
