from flask import Blueprint, request, jsonify

test_webhook_bp = Blueprint('test_webhook', __name__, url_prefix='/api/test')

# Base de datos simulada de ingredientes
INGREDIENTES_DB = {
    'nuez': {
        'nombre': 'Nuez',
        'descripcion': 'Fruto seco oleaginoso de alto valor nutricional, rico en grasas saludables y proteínas',
        'alergias': 'frutos secos',
        'intolerancias': 'histamina,tiramina',
        'tipo': 'fruto seco',
        'origen': 'América Central y Sudamérica',
        'organico': False,
        'notas': 'Consumir con moderación, contiene ácido fítico'
    },
    'leche': {
        'nombre': 'Leche',
        'descripcion': 'Líquido nutritivo de origen animal rico en calcio y proteínas',
        'alergias': 'caseína,lactosa',
        'intolerancias': 'lactosa',
        'tipo': 'lácteo',
        'origen': 'España',
        'organico': False,
        'notas': 'Fuente importante de calcio y vitamina D'
    },
    'trigo': {
        'nombre': 'Trigo',
        'descripcion': 'Cereal con gluten, base de harinas y pan',
        'alergias': 'gluten',
        'intolerancias': 'celiaquia',
        'tipo': 'cereal',
        'origen': 'España',
        'organico': False,
        'notas': 'Contiene gluten, no apto para celíacos'
    },
    'huevo': {
        'nombre': 'Huevo',
        'descripcion': 'Alimento de origen animal con proteína completa',
        'alergias': 'proteína de huevo',
        'intolerancias': '',
        'tipo': 'proteína',
        'origen': 'España',
        'organico': False,
        'notas': 'Alérgeno común en niños'
    },
    'plátano': {
        'nombre': 'Plátano',
        'descripcion': 'Fruta tropical rica en potasio y carbohidratos',
        'alergias': '',
        'intolerancias': 'histamina (cuando está muy maduro)',
        'tipo': 'fruta',
        'origen': 'América Tropical',
        'organico': False,
        'notas': 'Alto contenido en potasio'
    },
    'espinaca': {
        'nombre': 'Espinaca',
        'descripcion': 'Verdura verde oscura rica en hierro y vitaminas',
        'alergias': '',
        'intolerancias': '',
        'tipo': 'verdura',
        'origen': 'Región Mediterránea',
        'organico': False,
        'notas': 'Alto contenido en oxalatos, puede interferir con absorción de calcio'
    },
    'salmón': {
        'nombre': 'Salmón',
        'descripcion': 'Pescado graso rico en Omega-3 y proteínas',
        'alergias': 'pescado',
        'intolerancias': 'histamina (en conservas)',
        'tipo': 'pescado',
        'origen': 'Noruega, Islandia',
        'organico': False,
        'notas': 'Excelente fuente de Omega-3'
    },
    'miel': {
        'nombre': 'Miel',
        'descripcion': 'Endulzante natural producido por abejas',
        'alergias': '',
        'intolerancias': '',
        'tipo': 'endulzante',
        'origen': 'Diversos países',
        'organico': False,
        'notas': 'No dar a menores de 1 año por riesgo de botulismo'
    },
    'maní': {
        'nombre': 'Maní',
        'descripcion': 'Legumbre oleaginosa con alto contenido en proteínas y grasas',
        'alergias': 'cacahuete/maní',
        'intolerancias': 'histamina',
        'tipo': 'legumbre',
        'origen': 'América del Sur',
        'organico': False,
        'notas': 'Alérgeno potencial, puede causar reacciones severas'
    },
    'chocolate': {
        'nombre': 'Chocolate',
        'descripcion': 'Producto derivado del cacao con propiedades antioxidantes',
        'alergias': 'lactosa (en chocolate con leche)',
        'intolerancias': 'histamina,tiramina,cafeína',
        'tipo': 'dulce',
        'origen': 'América Central',
        'organico': False,
        'notas': 'Contiene cafeína, puede afectar el sueño'
    }
}


@test_webhook_bp.route('/webhook-ingrediente', methods=['POST'])
def webhook_ingrediente():
    """
    Webhook de prueba que simula el comportamiento de n8n.
    Recibe: { "nombre": "Nuez" }
    Retorna: datos del ingrediente de la BD simulada
    """
    try:
        data = request.get_json() or {}
        nombre = data.get('nombre', '').strip().lower()

        if not nombre:
            return jsonify({'error': 'Nombre requerido'}), 400

        # Buscar en la BD simulada
        if nombre in INGREDIENTES_DB:
            ingrediente = INGREDIENTES_DB[nombre]
            return jsonify(ingrediente), 200

        # Si no existe, retornar valores por defecto
        return jsonify({
            'nombre': nombre.title(),
            'descripcion': '',
            'alergias': '',
            'intolerancias': '',
            'tipo': '',
            'origen': '',
            'organico': False,
            'notas': 'Ingrediente no encontrado en BD de prueba'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@test_webhook_bp.route('/webhook-ingrediente/debug', methods=['GET'])
def webhook_debug():
    """
    Endpoint de debug para ver qué ingredientes están disponibles
    """
    return jsonify({
        'disponibles': list(INGREDIENTES_DB.keys()),
        'total': len(INGREDIENTES_DB),
        'descripcion': 'Base de datos simulada para pruebas del webhook'
    }), 200
