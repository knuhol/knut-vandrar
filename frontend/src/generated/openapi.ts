/* Generated from FastAPI by backend/scripts/export_openapi.py. */
export const openapi = {
  "openapi": "3.1.0",
  "info": {
    "title": "Knut vandrar API",
    "version": "0.1.0"
  },
  "paths": {
    "/api/locations": {
      "get": {
        "tags": [
          "locations"
        ],
        "summary": "Get Locations",
        "operationId": "get_locations_api_locations_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "items": {
                    "$ref": "#/components/schemas/LocationRead"
                  },
                  "type": "array",
                  "title": "Response Get Locations Api Locations Get"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "locations"
        ],
        "summary": "Create Location",
        "operationId": "create_location_api_locations_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LocationCreate"
              }
            }
          },
          "required": true
        },
        "responses": {
          "201": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LocationRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/locations/{location_id}": {
      "get": {
        "tags": [
          "locations"
        ],
        "summary": "Get Location",
        "operationId": "get_location_api_locations__location_id__get",
        "parameters": [
          {
            "name": "location_id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "title": "Location Id"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LocationRead"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/": {
      "get": {
        "tags": [
          "health"
        ],
        "summary": "Root",
        "operationId": "root__get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": {
                    "type": "string"
                  },
                  "type": "object",
                  "title": "Response Root  Get"
                }
              }
            }
          }
        }
      }
    },
    "/api/health": {
      "get": {
        "tags": [
          "health"
        ],
        "summary": "Health",
        "description": "Report healthy only when the API can reach its database.",
        "operationId": "health_api_health_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": {
                    "type": "string"
                  },
                  "type": "object",
                  "title": "Response Health Api Health Get"
                }
              }
            }
          },
          "503": {
            "description": "Database unavailable",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthUnavailable"
                }
              }
            }
          }
        }
      }
    },
    "/health": {
      "get": {
        "tags": [
          "health"
        ],
        "summary": "Health",
        "description": "Report healthy only when the API can reach its database.",
        "operationId": "health_health_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": {
                    "type": "string"
                  },
                  "type": "object",
                  "title": "Response Health Health Get"
                }
              }
            }
          },
          "503": {
            "description": "Database unavailable",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthUnavailable"
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "HTTPValidationError": {
        "properties": {
          "detail": {
            "items": {
              "$ref": "#/components/schemas/ValidationError"
            },
            "type": "array",
            "title": "Detail"
          }
        },
        "type": "object",
        "title": "HTTPValidationError"
      },
      "HealthUnavailable": {
        "properties": {
          "detail": {
            "type": "string",
            "title": "Detail"
          }
        },
        "type": "object",
        "required": [
          "detail"
        ],
        "title": "HealthUnavailable"
      },
      "LocationCreate": {
        "properties": {
          "name": {
            "type": "string",
            "title": "Name"
          },
          "description": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Description"
          },
          "latitude": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "title": "Latitude"
          },
          "longitude": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "title": "Longitude"
          },
          "visited": {
            "type": "boolean",
            "title": "Visited",
            "default": false
          }
        },
        "type": "object",
        "required": [
          "name"
        ],
        "title": "LocationCreate"
      },
      "LocationRead": {
        "properties": {
          "name": {
            "type": "string",
            "title": "Name"
          },
          "description": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "title": "Description"
          },
          "latitude": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "title": "Latitude"
          },
          "longitude": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "title": "Longitude"
          },
          "visited": {
            "type": "boolean",
            "title": "Visited",
            "default": false
          },
          "id": {
            "type": "integer",
            "title": "Id"
          },
          "created_at": {
            "anyOf": [
              {
                "type": "integer"
              },
              {
                "type": "null"
              }
            ],
            "title": "Created At"
          }
        },
        "type": "object",
        "required": [
          "name",
          "id"
        ],
        "title": "LocationRead"
      },
      "ValidationError": {
        "properties": {
          "loc": {
            "items": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "integer"
                }
              ]
            },
            "type": "array",
            "title": "Location"
          },
          "msg": {
            "type": "string",
            "title": "Message"
          },
          "type": {
            "type": "string",
            "title": "Error Type"
          },
          "input": {
            "title": "Input"
          },
          "ctx": {
            "type": "object",
            "title": "Context"
          }
        },
        "type": "object",
        "required": [
          "loc",
          "msg",
          "type"
        ],
        "title": "ValidationError"
      }
    }
  }
} as const
