type Engine = 'auto' | 'cloud' | 'browser'

export function selectInputEngine(options: { engine: Engine; nativeAndroid: boolean; canRecord: boolean; cloudAvailable: boolean; cloudFailed: boolean; browserAvailable: boolean; browserFailed: boolean }): 'cloud' | 'browser' {
  if (options.nativeAndroid) return 'cloud'
  if (options.engine !== 'auto') return options.engine
  if (options.canRecord && !options.cloudFailed && (options.cloudAvailable || options.browserFailed || !options.browserAvailable)) return 'cloud'
  return options.browserAvailable && !options.browserFailed ? 'browser' : 'cloud'
}

export function selectOutputEngine(options: { engine: Engine; nativeAndroid: boolean; cloudAvailable: boolean; cloudFailed: boolean; matchingVoice: boolean }): 'cloud' | 'browser' {
  if (options.nativeAndroid) return 'cloud'
  if (options.engine !== 'auto') return options.engine
  if (options.cloudAvailable && !options.cloudFailed) return 'cloud'
  return options.matchingVoice ? 'browser' : 'cloud'
}
