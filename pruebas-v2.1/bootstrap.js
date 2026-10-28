import {firebaseConfig} from './firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
const $=id=>document.getElementById(id);const status=t=>$('status').textContent=t;
try{
const app=initializeApp(firebaseConfig),auth=getAuth(app);const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
onAuthStateChanged(auth,user=>{ $('login').hidden=!!user;$('account').hidden=!user;if(user){$('email').textContent=user.email||'(sin correo)';$('uid').textContent=user.uid;status('Autenticación exitosa. Verifica que sea el Gmail administrador antes de crear el perfil en Firestore.')}else status('Esperando inicio de sesión.');});
$('enter').addEventListener('click',async()=>{try{status('Abriendo Google...');await signInWithPopup(auth,provider)}catch(e){status('Error: '+e.code+' — '+e.message+'\nSi aparece auth/unauthorized-domain, agrega este dominio en Authentication → Configuración → Dominios autorizados.')}});
$('logout').addEventListener('click',async()=>{try{await signOut(auth)}catch(e){status(e.message)}});
$('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(auth.currentUser?.uid||'');status('UID copiado.')}catch(e){status('No se pudo copiar automáticamente. Selecciona el UID y cópialo manualmente.')}});
}catch(e){status('No se pudo inicializar Firebase: '+e.message)}
