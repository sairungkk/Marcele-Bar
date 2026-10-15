src = open(r'C:\Users\DELL\.zcode\workspace\default\Bar_Stock_Control.html', encoding='utf-8').read()
fixes = 0

# 1. dialog footer: add Template + Import buttons and hidden input
old = '''    <div class="modal-actions" style="justify-content:space-between">
      <button class="btn ghost" id="meCheck">✓ Check counts</button>
      <button class="btn" id="meFinish">Complete month end →</button>
    </div>'''
new = '''    <div class="modal-actions" style="justify-content:space-between">
      <button class="btn ghost" id="meCheck">✓ Check counts</button>
      <span style="flex:1"></span>
      <button class="btn ghost small" id="meTpl">⬇ Template</button>
      <button class="btn ghost small" id="meImportPick">⬆ Import</button>
      <input type="file" id="fileCountMe" accept=".csv,.xls,.xml" style="display:none">
      <button class="btn" id="meFinish">Complete month end →</button>
    </div>'''
if 'id="meTpl"' not in src:
    assert src.count(old) == 1, "me footer not found"
    src = src.replace(old, new); fixes += 1

# 2. buildCountTemplateXml: optional single-outlet filter
old = '''function buildCountTemplateXml(){
  const sheets=[];
  const safe=n=>String(n).replace(/[\\\\\\/?:*\\[\\]]/g," ").trim().slice(0,24);
  S.outlets.forEach(o=>{'''
new = '''function buildCountTemplateXml(onlyOutlet){
  const sheets=[];
  const safe=n=>String(n).replace(/[\\\\\\/?:*\\[\\]]/g," ").trim().slice(0,24);
  const outs=(onlyOutlet && S.outlets.find(o=>li(o)===li(onlyOutlet))) ? [S.outlets.find(o=>li(o)===li(onlyOutlet))] : S.outlets;
  outs.forEach(o=>{'''
if 'function buildCountTemplateXml(onlyOutlet)' not in src:
    assert src.count(old) == 1, "tpl head not found"
    src = src.replace(old, new); fixes += 1

# 3. listeners: template (current dialog outlet) + import (refresh dialog after)
old = '''$("meCheck").addEventListener("click",()=>{'''
new = '''$("meTpl").addEventListener("click",()=>{
  const blob=new Blob(["\\ufeff"+buildCountTemplateXml(meOutletNow())],{type:"application/vnd.ms-excel"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="month-end-count-"+meOutletNow().replace(/\\s+/g,"-")+".xls";
  a.click(); URL.revokeObjectURL(a.href);
});
$("meImportPick").addEventListener("click",()=>{
  if(role!=="admin"){ alert("Only admin can import counts."); return; }
  $("fileCountMe").click();
});
$("fileCountMe").addEventListener("change",e=>{
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    window.__countImportWasMe=true;
    handleCountImport(String(rd.result), f.name);
    renderMonthEnd(); updateMeProgress();
  };
  rd.readAsText(f,"utf-8");
  e.target.value="";
});
$("meCheck").addEventListener("click",()=>{'''
if 'id="meTpl"' in src and src.count('meImportPick").addEventListener') == 0:
    assert src.count(old) == 1, "meCheck anchor not found"
    src = src.replace(old, new); fixes += 1

open(r'C:\Users\DELL\.zcode\workspace\default\Bar_Stock_Control.html','w',encoding='utf-8').write(src)
print("fixes applied:", fixes)
