export { Board, type BoardMove, type BoardProps, type MoveInputMode } from './Board';
export {
  annotationColors,
  type AnnotationColor,
  type BoardArrow,
  type BoardHighlight,
} from './BoardLayers';
export { BOARD_THEME_IDS, boardThemes, type BoardTheme, type BoardThemeId } from './boardThemes';
export { ALL_SQUARES, squareToXY, xyToSquare } from './geometry';
export { PieceIcon, type PieceIconProps } from './PieceIcon';
export { pieceSvg, type PieceColor, type PieceKind } from './pieceShapes';
export { diffPieces, keyPieces, type KeyedPiece } from './pieceDiff';
