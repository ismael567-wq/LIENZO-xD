; tiza — tolerancia a fallos al actualizar desde versiones antiguas.
;
; En algunas instalaciones de Windows el desinstalador de la versión anterior
; devuelve un código de error (por ejemplo 2) y electron-builder aborta la
; actualización con "Fallo al desinstalar archivos antiguos". En ese caso
; limpiamos la carpeta anterior y seguimos con la instalación: los tableros
; viven en %APPDATA%\tiza (o en el perfil heredado de Lienzo) y no se tocan.

!ifndef BUILD_UNINSTALLER
  Var /GLOBAL lienzoOldInstallDir
!endif

!macro lienzoCleanupFailedUninstall ROOT_KEY
  ${If} $R0 != 0
    DetailPrint "La desinstalación anterior falló ($R0). Limpiando la instalación anterior de tiza…"
    !insertmacro readReg $lienzoOldInstallDir "${ROOT_KEY}" "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${If} $lienzoOldInstallDir != ""
      RMDir /r "$lienzoOldInstallDir"
    ${EndIf}
    DeleteRegKey ${ROOT_KEY} "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}"
    ClearErrors
  ${EndIf}
!macroend

!macro customUnInstallCheck
  !insertmacro lienzoCleanupFailedUninstall SHELL_CONTEXT
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro lienzoCleanupFailedUninstall HKEY_CURRENT_USER
!macroend
