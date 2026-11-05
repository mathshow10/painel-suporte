@echo off
REM Modo diagnostico: mantem a janela preta aberta para ver mensagens de erro.
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 painel_suporte.py --console %*
) else (
  python painel_suporte.py --console %*
)
if errorlevel 1 (
  echo.
  echo Ocorreu um erro. Detalhes acima e no arquivo erro_painel.log
  pause
)
