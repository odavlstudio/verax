import React from 'react';

/**
 * Dynamic product page
 * The [id] segment should be SKIPPED during extraction
 * because it's a dynamic segment, not a static route
 */
export default function ProductDetail() {
  return React.createElement(
    'div',
    null,
    React.createElement('h1', null, 'Product Details')
  );
}
