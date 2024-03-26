import { Dashboard } from './dashboard'

const dashboard = new Dashboard()
const url = dashboard.serve()

console.log(`listening on ${url}`)