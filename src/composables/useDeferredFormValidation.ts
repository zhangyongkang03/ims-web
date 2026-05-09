import type { FormInstance } from 'element-plus'
import { nextTick, ref, type Ref } from 'vue'

export function useDeferredFormValidation(formRef: Ref<FormInstance | undefined>) {
  const interactionValidationEnabled = ref(false)

  const enableInteractionValidation = () => {
    interactionValidationEnabled.value = true
  }

  const resetInteractionValidation = () => {
    interactionValidationEnabled.value = false
    formRef.value?.clearValidate()
  }

  const validateFieldIfNeeded = async (prop: string) => {
    if (!interactionValidationEnabled.value) return
    await nextTick()
    formRef.value?.validateField(prop).catch(() => undefined)
  }

  return {
    interactionValidationEnabled,
    enableInteractionValidation,
    resetInteractionValidation,
    validateFieldIfNeeded,
  }
}
