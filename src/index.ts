type ModuleName = string;
type ActionName = string;
type ActionFullName = string;
type ModuleStateGetter<ModuleState> = (state: any) => ModuleState
type ActionReducer<ModuleState, Payload> = (moduleState: ModuleState, payload: Payload, globalState?: any) => ModuleState
type ActionEffect<ModuleState, Payload> = (moduleState: ModuleState, payload: Payload, store?: any) => void

type Module<ModuleState> = {
    name: ModuleName
    initialState: ModuleState
    getModuleState: ModuleStateGetter<ModuleState>
}
type Action<ModuleState, Payload> = {
    name: ActionName
    module: Module<ModuleState>
    reducer?: ActionReducer<ModuleState, Payload>
    effect?: ActionEffect<ModuleState, Payload>
}

type ModuleCreator = <ModuleState>(moduleName: string, initialState: ModuleState) => {
    getModuleState: ModuleStateGetter<ModuleState>
    createAction: ActionCreator<ModuleState>
}

type ActionCreator<ModuleState> = <Payload>(actionName: ActionName, reducer?: ActionReducer<ModuleState, Payload>, effect?: ActionEffect<ModuleState, Payload>) => {
    actionFactory: (payload: Payload) => (dispatch: ({ type: string, payload: Payload }) => void) => void
    actionFullName: ActionFullName
}

const getActionFullName = (moduleName: ModuleName, actionName: ActionName): ActionFullName => actionName + '-' + moduleName;

const modules = new Map<ModuleName, Module<any>>();
const actions = new Map<ActionFullName, Action<any, any>>();

export const getModuleNameList = () => modules.keys();
export const getActionNameList = () => actions.keys();

export const reducer = (state, action: { name: string, payload: any }) => {
    const actionInstance = actions.get(action.name)
    if (actionInstance && actionInstance.reducer) {
        const moduleState = actionInstance.module.getModuleState(state)
        return {
            ...state,
            [actionInstance.module.name]: actionInstance.reducer(moduleState, action.payload, state)
        }
    }
}

export const createModule: ModuleCreator = <ModuleState>(moduleName: string, initialState: ModuleState) => {
    if (modules.has(moduleName)) {
        throw new Error(`Module with name '${moduleName}' already exist`)
    }

    const module = {
        name: moduleName,
        initialState,
        getModuleState: (state) => state && state[moduleName]
    };
    modules.set(moduleName, module);

    return {
        getModuleState: module.getModuleState,
        createAction:
            <Payload>(actionName: ActionName, reducer?: ActionReducer<ModuleState, Payload>, effect?: ActionEffect<ModuleState, Payload>) => {
                const actionFullName = getActionFullName(moduleName, actionName)
                return ({
                    actionFactory: (payload: Payload) =>
                        (dispatch: ({ type: string, payload: Payload }) => void) => {
                            const action = {
                                name: actionName,
                                module,
                                reducer,
                                effect
                            }
                            if (actions.has(actionFullName)) {
                                throw new Error(`Action with name '${actionFullName}' already exist`)
                            }
                            actions.set(actionFullName, action)
                            dispatch({ type: actionFullName, payload })
                        },
                    actionFullName: actionFullName
                })
            }

    }
}

type ActionType = { type: string, payload: any }
export const middleware = (store: { getState: () => any }) => (next: (action: ActionType) => void) => (action: ActionType) => {
    const actionInstance = actions.get(action.type)
    if (actionInstance && actionInstance.effect) {
        const moduleState = actionInstance.module.getModuleState(store.getState())
        actionInstance.effect(moduleState, action.payload, store)
    }
    next(action);
}