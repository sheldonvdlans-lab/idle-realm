import { render } from 'preact'
import { startLoop } from './store'
import { App } from './ui/App'
import './style.css'

startLoop()
render(<App />, document.getElementById('app')!)
