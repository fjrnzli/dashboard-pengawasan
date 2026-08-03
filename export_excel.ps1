$ErrorActionPreference = "SilentlyContinue"

$excelPath = "D:\OJT PCT 3\LAPORAN AKHIR OJT\Projek Orientasi PCT 3\DASHBOARD.xlsm"
$csvPath = "D:\OJT PCT 3\LAPORAN AKHIR OJT\Projek Orientasi PCT 3\raw_export.csv"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$wb = $excel.Workbooks.Open($excelPath)
$ws = $wb.Sheets.Item("DATA")

# Export using SaveAs CSV - most reliable method
$ws.Copy() # copies to new workbook
$newWb = $excel.ActiveWorkbook
$newWb.SaveAs($csvPath, 6) # 6 = xlCSV
$newWb.Close($false)

$wb.Close($false)
$excel.Quit()

try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {}
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

Write-Host "CSV exported successfully to $csvPath"
