import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Altura do teclado, para dar espaço embaixo de um modal. Não usamos KeyboardAvoidingView:
 * no Android ele brigava com o redimensionamento da janela e a tela tremia.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
