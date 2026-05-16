declare module 'swagger-ui-react' {
  import { ComponentType } from 'react'
  interface SwaggerUIProps {
    url?: string
    spec?: object
    specFile?: string
    dom_id?: string
    options?: object
    presets?: any[]
    plugins?: any[]
    layout?: string
    showExplorer?: boolean
    swagger2Builder?: boolean
    validatorUrl?: string | null
    oauth2RedirectUrl?: string
    fetch?: typeof fetch
    requestInterceptor?: (request: Request) => Request | Promise<Request>
    responseInterceptor?: (response: Response) => Response | Promise<Response>
    docExpansion?: 'list' | 'full' | 'none'
    defaultModelsExpandDepth?: number
    defaultModelExpandDepth?: number
    defaultModelRendering?: 'example' | 'model'
    displayOperationId?: boolean
    displayRequestDuration?: boolean
    deepLinking?: boolean
    filter?: boolean | string
    maxDisplayedTags?: number
    showExtensions?: boolean
    showCommonExtensions?: boolean
    supportedSubmitMethods?: string[]
    [key: string]: any
  }
  const SwaggerUI: ComponentType<SwaggerUIProps>
  export default SwaggerUI
}