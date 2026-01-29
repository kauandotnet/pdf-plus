/**
 * Image extraction strategies
 */

export {
  handleFilter,
  getFilterHandlerName,
  isFilterSupported,
  setPngCreator,
  setPredictorDecoder,
  setColorComponentsGetter,
  FILTER_HANDLERS,
  type FilterResult,
  type FilterContext,
  type PngCreator,
  type PredictorDecoder,
} from "./filter-handlers.js";
