/**
 * @chess-open/core — pure logic shared by the app and the data pipeline.
 *
 * Rule: nothing in this package may import React, React Native or Expo.
 * Everything here must be covered by unit tests.
 */

/** Version of the Opening Pack format this build of the app understands. */
export const SUPPORTED_PACK_FORMAT = 1;

export * from './chess';
export * from './pack';
export * from './pgn';
export * from './explorer';
export * from './engine';
export * from './puzzles';
export * from './textcheck';
