const subscribers = new Set()
let currentState = {
  activeModule: null,
  moduleData: {}
}

export const moduleStateStore = {
  publish: (module, data) => {
    currentState = {
      activeModule: module,
      moduleData: { ...currentState.moduleData, [module]: data }
    }
    subscribers.forEach(fn => fn(currentState))
  },
  subscribe: (fn) => {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  },
  getState: () => currentState
}
