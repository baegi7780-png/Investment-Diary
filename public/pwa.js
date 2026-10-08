import {toCanvas} from '/vendor/qrcode.mjs';
import {publicAccessUrl} from '/access-url.mjs';
const $=s=>document.querySelector(s);
let pendingInstall=null;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function updateInstallStatus(){
  $('#install-app').hidden=!pendingInstall||standalone();
  $('#install-status').textContent=standalone()?'현재 앱 전용 창에서 사용 중입니다.':pendingInstall?'이 브라우저에서 설치할 수 있습니다. 아래 버튼을 눌러주세요.':'설치 버튼이 보이지 않으면 아래 브라우저별 방법을 이용하세요.';
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pendingInstall=event;updateInstallStatus()});
window.addEventListener('appinstalled',()=>{pendingInstall=null;updateInstallStatus()});
matchMedia('(display-mode: standalone)').addEventListener('change',updateInstallStatus);
const shareUrl=publicAccessUrl(location.href);
$('#open-access').addEventListener('click',async()=>{
  $('#access-dialog').showModal();updateInstallStatus();
  $('#qr-area').hidden=!shareUrl;
  if(!shareUrl){$('#access-status').textContent='현재는 로컬 개발 주소입니다. 휴대폰으로 이 PC의 localhost에 접속할 수 없습니다. Cloudflare HTTPS 배포 후 이곳에 실제 접속 QR이 자동으로 표시됩니다.';return}
  $('#access-status').textContent='휴대폰 카메라로 아래 QR을 스캔하세요. 접속 후 자신의 계정으로 로그인해야 합니다.';
  $('#access-url').textContent=shareUrl;
  try{await toCanvas($('#access-qr'),shareUrl,{width:248,margin:4,errorCorrectionLevel:'M',color:{dark:'#0b1220',light:'#ffffff'}});$('#download-qr').href=$('#access-qr').toDataURL('image/png')}
  catch{$('#qr-area').hidden=true;$('#access-status').textContent='QR을 생성하지 못했습니다. 주소창의 사이트 주소를 휴대폰에서 직접 입력하세요.'}
});
$('#close-access').addEventListener('click',()=>$('#access-dialog').close());
$('#copy-access-url').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(shareUrl);$('#access-status').textContent='접속 주소를 복사했습니다.'}catch{$('#access-status').textContent='주소 복사를 허용하지 않는 브라우저입니다. 표시된 주소를 직접 복사하세요.'}});
$('#install-app').addEventListener('click',async()=>{
  if(!pendingInstall)return;
  const prompt=pendingInstall;pendingInstall=null;updateInstallStatus();
  try{await prompt.prompt();const choice=await prompt.userChoice;$('#install-status').textContent=choice.outcome==='accepted'?'설치 요청을 수락했습니다. 홈 화면이나 앱 목록에서 투자노트를 확인하세요.':'설치를 취소했습니다. 브라우저 메뉴에서 나중에 설치할 수 있습니다.'}
  catch{$('#install-status').textContent='아래 브라우저 메뉴의 설치 방법을 이용하세요.'}
});
if('serviceWorker' in navigator&&window.isSecureContext){navigator.serviceWorker.register('/sw.js').catch(()=>{$('#install-status').textContent='앱 준비를 완료하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 접속하세요.'})}
