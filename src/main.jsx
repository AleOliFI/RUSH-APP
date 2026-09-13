import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ------------------------------------------------------------------
// Os ícones do app são ligaduras da fonte "Material Symbols Outlined".
// Se a fonte não carregar (rede lenta, host bloqueado, modo offline), o
// navegador renderiza o NOME da ligadura como texto ("directions_run")
// e destrói o layout. Enquanto a fonte não estiver comprovadamente
// disponível, os glifos ficam invisíveis mas ocupam o espaço reservado.
//
// document.fonts.check() NÃO serve aqui: pela especificação ele devolve
// true quando não existe nenhuma @font-face correspondente (o navegador
// considera a família "disponível" via fallback). A verificação confiável
// é comparar a largura do texto renderizado com e sem a família alvo.
// ------------------------------------------------------------------
const ICON_FONT_FAMILY = 'Material Symbols Outlined'

function isFontAvailable(family) {
  try {
    const probe = 'mmmmmmmmmmlli'
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return false
    ctx.font = '72px monospace'
    const fallbackWidth = ctx.measureText(probe).width
    ctx.font = `72px "${family}", monospace`
    return ctx.measureText(probe).width !== fallbackWidth
  } catch {
    return false
  }
}

function watchIconFont() {
  const reveal = () => document.documentElement.classList.add('icons-ready')

  let attempts = 0
  const tryReveal = () => {
    if (isFontAvailable(ICON_FONT_FAMILY)) {
      reveal()
      return
    }
    // Até ~8s de tolerância para redes lentas. Se a fonte nunca chegar, os
    // ícones permanecem ocultos e o layout continua íntegro.
    if (++attempts < 16) setTimeout(tryReveal, 500)
  }

  if (document.fonts?.load) {
    document.fonts.load(`24px "${ICON_FONT_FAMILY}"`).then(tryReveal).catch(tryReveal)
  } else {
    tryReveal()
  }
}

watchIconFont()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
