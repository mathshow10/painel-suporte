' Abre o Painel de Suporte sem janela preta (CMD).
Option Explicit
Dim sh, fso, pasta, script, ok
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
script = """" & pasta & "\painel_suporte.py"""
sh.CurrentDirectory = pasta
ok = False

On Error Resume Next
Err.Clear
sh.Run "pyw -3 " & script, 0, False
If Err.Number = 0 Then ok = True
If Not ok Then
  Err.Clear
  sh.Run "pythonw " & script, 0, False
  If Err.Number = 0 Then ok = True
End If
On Error GoTo 0

If Not ok Then
  MsgBox "Não encontrei o Python instalado." & vbCrLf & _
         "Instale em python.org (marque 'Add Python to PATH' e 'tcl/tk and IDLE').", 16, "Painel de Suporte"
End If
