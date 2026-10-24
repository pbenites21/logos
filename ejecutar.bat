@echo off
set "RUTA_PROYECTO=C:\Users\kistofe\Desktop\Repair-Sync-main"

:: Abre Windows Terminal con una pestaña inicial en la carpeta indicada
wt -d "%RUTA_PROYECTO%" cmd /k "echo [Pestaña 1] && node server.js" ; ^
new-tab -d "%RUTA_PROYECTO%" cmd /k "echo [Pestaña 2] && npm run dev" ; ^
new-tab -d "%RUTA_PROYECTO%" cmd /k "echo [Pestaña 3] && cloudflared tunnel run --token eyJhIjoiNTZjODEzZjYxNGIwYjAwYjdjYWJkZGNhMzkwOWM4NDMiLCJ0IjoiNWJhMDE1ZWMtMTIzZi00MDE0LTgyYjMtZDI3ZTAwN2ViMTQ3IiwicyI6Ik1qWXlOek00WXpZdFpUUTJaaTAwTkRreUxXRTBOMk10TXpjek1UVTBabVptTnpKaCJ9" ; ^
new-tab -d "%RUTA_PROYECTO%" cmd /k "echo [Pestaña 4] && node E-SRC/auth.js" ; ^
new-tab -d "%RUTA_PROYECTO%" cmd /k "echo [Pestaña 5] && node E-SRC/sync.cjs"

exit