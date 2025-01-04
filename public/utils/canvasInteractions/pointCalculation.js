// utils/canvasInteraction/pointCalculation.js

export const createPointCalculation = (props) => {
  const {
    cards,
    canvasRef,
    zoomLevel,
    SNAP_RADIUS,
    GRID_SIZE,
    findNearestSocket,
    calculateConnectionPoint,
  } = props;

  // Point calculation with error handling
  const getScaledPoint = (point, useCache = true) => {
    if (!canvasRef.value) {
      console.warn("Canvas reference not available for scaling point");
      return point;
    }

    try {
      const rect = canvasRef.value.getBoundingClientRect();
      const scrollLeft = canvasRef.value.scrollLeft;
      const scrollTop = canvasRef.value.scrollTop;

      return {
        x: (point.x - rect.left + scrollLeft - 4000) / zoomLevel.value,
        y: (point.y - rect.top + scrollTop - 4000) / zoomLevel.value,
      };
    } catch (error) {
      console.error("Error scaling point:", error);
      return point;
    }
  };

  // Enhanced client point calculation
  const getClientPoint = (worldPoint) => {
    if (!canvasRef.value) return worldPoint;

    try {
      const rect = canvasRef.value.getBoundingClientRect();
      const scrollLeft = canvasRef.value.scrollLeft;
      const scrollTop = canvasRef.value.scrollTop;

      return {
        x: worldPoint.x * zoomLevel.value + rect.left - scrollLeft + 4000,
        y: worldPoint.y * zoomLevel.value + rect.top - scrollTop + 4000,
      };
    } catch (error) {
      console.error("Error calculating client point:", error);
      return worldPoint;
    }
  };


  // Enhanced grid calculations
  const snapToGrid = (point, size = GRID_SIZE) => {
    return {
      x: Math.round(point.x / size) * size,
      y: Math.round(point.y / size) * size,
    };
  };

  // Precise distance calculation
  const getDistance = (point1, point2) => {
    if (!point1 || !point2) return Infinity;
    return Math.hypot(point2.x - point1.x, point2.y - point2.y);
  };

  // Enhanced bounds checking with padding
  const isPointInBounds = (point, bounds, padding = 0) => {
    if (!point || !bounds) return false;
    return (
      point.x >= bounds.left - padding &&
      point.x <= bounds.right + padding &&
      point.y >= bounds.top - padding &&
      point.y <= bounds.bottom + padding
    );
  };

  // Enhanced relative position calculation
  const getRelativePosition = (element, includeScroll = true) => {
    if (!canvasRef.value || !element) return null;

    try {
      const canvasRect = canvasRef.value.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const scrollOffset = includeScroll
        ? {
            x: canvasRef.value.scrollLeft,
            y: canvasRef.value.scrollTop,
          }
        : { x: 0, y: 0 };

      return {
        x:
          (elementRect.left - canvasRect.left + scrollOffset.x) /
          zoomLevel.value,
        y:
          (elementRect.top - canvasRect.top + scrollOffset.y) / zoomLevel.value,
      };
    } catch (error) {
      console.error("Error calculating relative position:", error);
      return null;
    }
  };

  // Enhanced center calculation
  const calculateCenterPoint = (points) => {
    if (!points?.length) return null;

    try {
      const validPoints = points.filter(
        (point) =>
          point && typeof point.x === "number" && typeof point.y === "number"
      );

      if (validPoints.length === 0) return null;

      const sum = validPoints.reduce(
        (acc, point) => ({
          x: acc.x + point.x,
          y: acc.y + point.y,
        }),
        { x: 0, y: 0 }
      );

      return {
        x: sum.x / validPoints.length,
        y: sum.y / validPoints.length,
      };
    } catch (error) {
      console.error("Error calculating center point:", error);
      return null;
    }
  };

  // Enhanced intersection calculation
  const getIntersectionPoint = (rect1, rect2) => {
    if (!rect1 || !rect2) return null;

    try {
      const center1 = {
        x: (rect1.left + rect1.right) / 2,
        y: (rect1.top + rect1.bottom) / 2,
      };

      const center2 = {
        x: (rect2.left + rect2.right) / 2,
        y: (rect2.top + rect2.bottom) / 2,
      };

      const angle = Math.atan2(center2.y - center1.y, center2.x - center1.x);

      return {
        x: center1.x + (Math.cos(angle) * rect1.width) / 2,
        y: center1.y + (Math.sin(angle) * rect1.height) / 2,
      };
    } catch (error) {
      console.error("Error calculating intersection:", error);
      return null;
    }
  };

  // Enhanced coordinate transformation
  const transformCoordinates = {
    worldToScreen: (worldPoint) => {
      if (!worldPoint) return null;
      return getClientPoint(worldPoint);
    },

    screenToWorld: (screenPoint) => {
      if (!screenPoint) return null;
      return getScaledPoint(screenPoint);
    },

    elementToWorld: (element, elementPoint) => {
      if (!element || !elementPoint) return null;
      try {
        const rect = element.getBoundingClientRect();
        const screenPoint = {
          x: rect.left + elementPoint.x,
          y: rect.top + elementPoint.y,
        };
        return getScaledPoint(screenPoint);
      } catch (error) {
        console.error("Error transforming coordinates:", error);
        return null;
      }
    },
  };



  return {
    // Core calculations
    getScaledPoint,
    getClientPoint,
    findNearestSocket,
    getDistance,
    snapToGrid,

    // Position utilities
    isPointInBounds,
    getRelativePosition,
    calculateCenterPoint,
    getIntersectionPoint,

    // Coordinate transformation
    transformCoordinates,

  };
};
