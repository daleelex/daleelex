import { toast } from 'react-toastify';
import { ToastOptions } from 'react-toastify';
import { EToastType } from '../global/global.enums';
import { defaultToastConfig } from '../configs/default-values';

export const getErrorMessage = (message: any) => {
  let errorMessage;
  switch (true) {
    case typeof message === 'string':
      errorMessage = message;
      break;
    case Array.isArray(message):
      errorMessage = message.join(', ');
      break;
    default:
      errorMessage = 'Server Error';
      break;
  }
  return errorMessage;
};

export const showToast = (type: EToastType, message: string, config?: ToastOptions) => {
  switch (type) {
    case EToastType.INFO:
      toast.info(message ?? 'No information available', config ?? defaultToastConfig);
      break;
    case EToastType.ERROR:
      toast.error(message ?? 'Something went wrong', config ?? defaultToastConfig);
      break;
    case EToastType.SUCCESS:
      toast.success(message ?? 'successs', config ?? defaultToastConfig);
      break;
  }
};
